// it only verify that user is present or not 

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.models.js";

export const verifyJWT = asyncHandler( async(req,res,next) =>{
    try {
        const token = req.cookies?.accessToken  || req.header("Authorization")?.replace("Bearer ","")
        
        if(!token) {
            throw new ApiError(401,"Unauthorized request")
        }
        // JWT ka use krr ke puch na pde ga ye token shi ha ya nhi 
        const decodedToken =  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken"  // ye nhi chiye
        )
        if(!user){            
            throw new ApiError(401,"Invalid Access Token")
        }
        // if user ha to req me user ka access de do 
        req.user = user;
        next()
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Access Token")
        
    }
})