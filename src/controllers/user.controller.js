import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiRespones } from "../utils/ApiResponse.js";
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
    console.log("email :",email);
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
    const exitedUser = User.findOne({
        $or: [{ email },{ username }] // multiple value check krni ha kr do object ke ander

    })
    if(exitedUser){
        throw new ApiError(409,"User already exited with username or email")
    }

    // check for images and avatar
    // multer req me files ki access de deta ha 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

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


export {registerUser}