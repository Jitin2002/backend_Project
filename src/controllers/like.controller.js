import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comment.model.js"
import {Tweet} from "../models/tweet.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleLike = async (Model,resourceID,userID)=>{
    if(!isValidObjectId(resourceID) || !isValidObjectId(userID)){
        throw new ApiError("Invalid ResourceID or UserID");
    }
    const model = Model.modelName;
    const isLiked = await Like.findOne({
        [model.toLowerCase()]: resourceID , 
        likedBy : userID        
        
    })

    let result;
    try {
        if(!isLiked){
            result = await Like.create({
                [model.toLowerCase()] : resourceID,
                likedBy : userID
            })
        }
        else {
            result = await Like.deleteOne({
                [model.toLowerCase()] : resourceID,
                likedBy : userID
            })
        }
        
    } catch (error) {
        throw new ApiError(500, error?.message || "Something went wrong in toggleLike.");
    }
    const totalLike = await Like.countDocument({
        [model.toLowerCase()] : resourceID
    })
    return (result,isLiked,totalLike)
}


const toggleVideoLike = asyncHandler(async (req,res) =>{
    const {videoID} = req.params
    if(!isValidObjectId(videoID)){
        throw new ApiError(400,"Invalid videoID")
    }
    const {isLiked, totalLikes}= await toggleLike(
        Video,videoID,req.user?._id
    )
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        {totalLikes},
        !isLiked?"Liked Successfully":"Liked removed Successfully"
    ))
})

const toggleCommentLike = asyncHandler(async(req,res)=>{
    const {commnetId} = req.params
    if(!isValidObjectId(commnetId)){
        throw new ApiError(400,"Invalid CommentId")
    }
    const {result ,isLiked,totalLikes} = await toggleLike(Comment,commnetId,req.user?._id)

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        {totalLikes},
        !isLiked?"Liked Successfully" : "Disliked Successfully"
    ))
})

const toggleTweetLike = asyncHandler(async(req,res)=>{
    const {tweetId} = req.params
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid tweetId")
    }
    const {isLiked,totalLike} = await toggleLike(Tweet,tweetId,req.user?._id)
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        { totalLikes },
        !isLiked?"Liked Successfully" : "Disliked Successfully"
    ))
})

const getLikedVideo = asyncHandler(async (req,res) =>{
    const userID = req.user?._id
    if(!isValidObjectId(userID)){
        throw new ApiError(401, "Invalid userID");
    }
    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userID),
                video: { $exists: true }
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $arrayElemAt: ["$owner", 0] },
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                details: { $arrayElemAt: ["$video", 0] }
            }
        }
    ]);
  
    return res.status(200).json(
        new ApiResponse(200, likedVideos, "Successfully fetched liked videos")
    );
})

export {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideo

}