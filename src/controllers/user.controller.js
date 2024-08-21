import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiRespones } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

// method to generate access and refresh token
const generateAccessAndRefreshToken = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken =  user.generateAccessToken()
        const refreshToken =  user.generateRefreshToken()

        // refresh token ko database me bhi save krna hota ha
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false }) // validation kuch na lagao direct save krr do

        return {accessToken , refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went worng while generating refresh and access token")
    }
}

const registerUser = asyncHandler( async (req,res)=>{
     //get user details from frontend
     // validation 
     // check if user already exist  : username ,email
     // check for images , check for avator
     // upload them to cloudinary , avatar
     // create user object - create entry in db
     // remove password and refresh token field from response
     // check for user creation
     // return user ,agar nhi hua to  return error 

    const {fullname, username, email,password} = req.body
    // console.log("email :",email);
    
    // ek ek chij ko check krr lo
    // if(fullname === ""){
    //     throw new ApiError(400,"fullname is required")
    // }
    // ya fir sab ko ek sath check krr lo -- validate
    if(
        [fullname ,email, username,password].some((field)=>
        field?.trim() === "") 
    ){
        throw new ApiError(400,"All fields are required")
    }

    // check already exist or not
    const exitedUser = await User.findOne({
        $or: [{ email },{ username }] // multiple value check krni ha kr do object ke ander

    })
    if(exitedUser){
        throw new ApiError(409,"User already exited with username or email")
    }
    // console.log(req.files);
    

    // check for images and avatar
    // multer req me files ki access de deta ha 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    //  clasic way me check krr lete ha coverImage ha ya nhi
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) 
        && req.files.coverImage.length > 0 ) {
            coverImageLocalPath = req.files.coverImage[0].path        
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }
    // now upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    // data base me entry mar do , User hi baat krr rha ha
    const user = await User.create({
        fullname,
        avatar : avatar.url, // sirf url store kru ga
        coverImage : coverImage?.url || "", // check kro ha ya nhi 
        email,
        password,
        username : username.toLowerCase()
    })
    // check for user creation , search kro DB me user ko ki hua ki nhi 
    // also remove password and refreshtoken
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" // jo nhi lene vo likh do with minus
    )
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }
    // how to craft response 
    return res.status(201).json(
        new ApiRespones(200, createdUser, "User Registered Successfully")
    )

} )

const loginUser = asyncHandler( async (req,res) =>{
    //req body ->data
    // username or email
    // find the user 
    // password check
    // access and refresh token generate 
    // send cookie -> cookies me token bhej do

    const {username , email, password} = req.body

    if(!(username || email)){
        throw new ApiError(400,"username or email is required")
    }

    const user =  await User.findOne({
        $or :[{email},{username}]  // find kre ga ya to username ke based mil jye ya email ke
    })
    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    // apne methods bnye ha vo apke user se access honge ,
    // mongodb ke methods User se access honge
    const isPasswordValid =  await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invaild user credentials")
    }

    const {accessToken , refreshToken} =  await generateAccessAndRefreshToken(user._id)

    
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = { // only server can update this 
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiRespones(200,
            {
                user : loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )    

})

// user logout
const logoutUser = asyncHandler( async(req,res) => {
    // cookies clear 
    await User.findByIdAndUpdate( // id , update kya krna ha
        req.user._id,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new : true  //return me response mile ga usme new updated value mile ge 
        }        
    )
    const options = {
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiRespones(200,{},"User Logged Out"))

})

// end point for refresh access token 

const refreshAccessToken = asyncHandler ( async(req,res) =>{
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken
    
    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
    // verify token 

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }
        // match incooming token and user refresh token
        if(incomingRefreshToken != user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const { accessToken , newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        const options = {
            httpOnly :true,
            secure : true
        }
    
        return res
        .status(200)
        .cookie("refreshToken",newRefreshToken,options)
        .cookie("accessToken",accessToken,options)
        .json(
            new ApiRespones(
                200,
                {accessToken , refreshToken :newRefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}