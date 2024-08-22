import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiRespones } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

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

    //  classic way me check krr lete ha coverImage ha ya nhi
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
            $unset : {
                refreshToken :1
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
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
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
        if(incomingRefreshToken !== user?.refreshToken){
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
                {accessToken , refreshToken : newRefreshToken},
                "Access Token Refreshed"
            ) 
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async (req,res) =>{
    const {oldPassword,newPassword} = req.body
    // auth middleware chala ha to req.user se id nikl lo 
    const user = await User.findById(req.user?._id)

    const isPasswordCorrect =  await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res.status(200).json(new ApiRespones(200,{},"Password changed Successfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiRespones(200,req.user,"current user fatched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res) =>{
    const {fullname , email} = req.body
    if(!fullname || !email){
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullname : fullname, // fullname : fullname 
                email : email
            }
        },
        {
            new : true
        }    
    ).select("-password")

    return res
    .status(200)
    .json(new ApiRespones(200 , user,"Account details successfully updated"))
})

const updateUserAvatar = asyncHandler(async(req,res) =>{
    const avatarLocalpath = req.file?.path
    if(!avatarLocalpath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalpath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading avatar on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set :{
                avatar : avatar.url
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiRespones(200,user,"Avatar successfully updated"))
})

const updateCoverImage = asyncHandler(async(req,res) =>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading coverImage on cloudinary")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set :{
                coverImage : coverImage.url
            }
        },
        {new : true}
    ).select("-password")
    return res
    .status(200)
    .json(new ApiRespones(200,user,"cover Image successfully updated"))
})

const getUserChannelProfile = asyncHandler(async(req,res) =>{

    const {username} = req.params
    // is it exist or not 
    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }
    // aggregation pipeline   --- values array aata ha waps
    const channel = await User.aggregate([
        {
            $match :{
                username : username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from : "subscriptions", // Subscription -> lower case me and plural ho jyti ha
                localField : "_id",
                foreignField :"channel",
                as : "subscribers"
            }
        },
        {
            $lookup :{
                from :"subscriptions",
                localField :"_id",
                foreignField :"subscriber",
                as : "subscribedTo"
            }

        },
        {// additional fields add krr dega user me
            $addFields :{ 
                subscribersCount : {
                    $size :"$subscribers"   // use $ as it is a field
                },
                channelsSubscribedToCount : {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond :{
                        if :{$in : [req.user?._id, "$subscribers.subscriber"]},
                        then : true,
                        else : false
                    }
                }
            }
        },
        {   // projection -- selected values ko project kru ga
            $project : {
                fullname :1,
                username :1,
                email :1,
                subscribersCount :1,
                channelsSubscribedToCount :1,
                isSubscribed :1,
                avatar :1,
                coverImage :1
            }
        }
    ])
    // array return kre ga channel
    if(!channel?.length){
        throw new ApiError(404,"channel does not exists")
    }

    return res
    .status(200)
    .json(new ApiRespones(200,channel[0],"User channel fetched Successfully"))


})

// watch history
const getWatchHistory = asyncHandler(async(req,res)=>{
    // req.user._id   // string mil ti ha , mongoose 
    // aggregation pipeline me isko objectId me convert krr ke bhj na ha

    const user = await User.aggregate([
        {
            $match :{
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup :{
                from : "videos",
                localField :"watchHistory",
                foreignField : "_id",
                as : "watchHistory",
                // sub pipeline for owner 
                pipeline :[
                    {
                        $lookup :{
                            from : "users",
                            localField :"owner",
                            foreignField : "_id",
                            as : "owner",
                            pipeline :[
                                {
                                    $project :{
                                        fullname :1,
                                        username:1,
                                        avatar :1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // array se first value
                        $addFields :{
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                    
                ]
            }
        }
        
            
        
    ])

    return res
    .status(200)
    .json(new ApiRespones(
        200,
        user[0].watchHistory,
        "Watch History Fetched Successfully"
    ))


})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
}