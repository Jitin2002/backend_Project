import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/likes.models.js"
import {Video} from "../models/video.models.js"
import {Comment} from "../models/comments.models.js"
import {Tweet} from "../models/tweet.models.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiRespones} from "../utils/ApiResponse.js";

const toggleLike = async (Model,resourceID,userID)=>{
    if(!isValidObjectId(resourceID) || !isValidObjectId(userID)){
        throw new ApiError("Invalid ResourceID or UserID");
    }
    const model = Model.modelName.toLowerCase();
    const isLiked = await Like.findOne({
        [model]: resourceID , 
        likedBy : userID        
        
    })

    let result;
    try {
        if(!isLiked){
            result = await Like.create({
                [model] : resourceID,
                likedBy : userID
            })
        }
        else {
            result = await Like.deleteOne({
                [model] : resourceID,
                likedBy : userID
            })
        }
        
    } catch (error) {
        throw new ApiError(500, error?.message || "Something went wrong in toggleLike.");
    }
    const totalLikes = await Like.countDocuments({
        [model] : resourceID
    })
    return {result,isLiked,totalLikes}
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
    .json(new ApiRespones(
        200,
        {totalLikes},
        !isLiked?"Liked Successfully":"Liked removed Successfully"
    ))
})

const toggleCommentLike = asyncHandler(async(req,res)=>{
    const {commentId} = req.params
    if(!isValidObjectId(commentId)){
        throw new ApiError(400,"Invalid CommentId")
    }
    const {isLiked,totalLikes} = await toggleLike(Comment,commentId,req.user?._id)

    return res
    .status(200)
    .json(new ApiRespones(
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
    const {isLiked,totalLikes} = await toggleLike(Tweet,tweetId,req.user?._id)
    return res
    .status(200)
    .json(new ApiRespones(
        200,
        { totalLikes },
        !isLiked?"Liked Successfully" : "Disliked Successfully"
    ))
})

const getLikedVideos = asyncHandler(async (req,res) =>{
    const userID = req.user?._id
    if(!isValidObjectId(userID)){
        throw new ApiError(401, "Invalid userID");
    }
    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user?._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideo",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerDetails",
                        },
                    },
                    {
                        $unwind: "$ownerDetails",
                    },
                ],
            },
        },
        {
            $unwind: "$likedVideo",
        },
        {
            $sort: {
                createdAt: -1,
            },
        },
        {
            $project: {
                _id: 0,
                likedVideo: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    owner: 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    isPublished: 1,
                    ownerDetails: {
                        username: 1,
                        fullName: 1,
                        "avatar.url": 1,
                    },
                },
            },
        },
    ]);
  
    return res.status(200).json(
        new ApiRespones(200, likedVideos, "Successfully fetched liked videos")
    );
})

export {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos

}