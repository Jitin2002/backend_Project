import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiRespones } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const createTweet = asyncHandler(async(req,res)=>{
    const {content}= req.body
    if(content?.trim() ===""){
        throw new ApiError(400,"content is missing")
    }
    const tweet = await Tweet.create({
        content,
        owner : req.user?._id
    })
    if(!tweet){
        throw new ApiError(500,"Something went wrong while creating tweet")
    }
    let newTweet = {
        ...tweet._doc, // spread the plain data
        owner: {
            fullname: req.user?.fullname,
            username: req.user?.username,
            avatar: req.user?.avatar,
        },
        totalDisLikes: 0,
        totalLikes: 0,
        isLiked: false,
        isDisLiked: false,
    }
    return res
    .status(201)
    .json(new ApiRespones(201,newTweet,"Tweet created Successfully"))
});

const getUserTweets = asyncHandler(async(req,res)=>{
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid userId");
    }

    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likeDetails",
                pipeline: [
                    {
                        $project: {
                            likedBy: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likeDetails",
                },
                ownerDetails: {
                    $first: "$ownerDetails",
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likeDetails.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            },
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                content: 1,
                ownerDetails: 1,
                likesCount: 1,
                createdAt: 1,
                isLiked: 1
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiRespones(200, tweets, "Tweets fetched successfully"));
})

const updateTweet = asyncHandler(async(req,res)=>{
    const {content} = req.body
    const {tweetId} = req.params
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid tweetId")
    }
    if (!content?.trim()) {
        throw new ApiError(400, "Content is required for updating tweet");
    }
    const tweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set :{
                content
            }
        },
        {new : true}
    )
    if(!tweet){
        throw new ApiError(500 ,"Error while updating tweet")
    }
    return res
    .status(200)
    .json(new ApiRespones(200,tweet,"Tweet updated Successfully"))
})

const deleteTweet = asyncHandler(async(req,res)=>{
    const {tweetId} = req.params
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid tweetId")
    }
    const tweet = await Tweet.findByIdAndDelete(tweetId)
    if(!tweet){
        throw new ApiError(500,"Something went wrong while deleting tweet")
    }
    return res
    .status(200)
    .json(new ApiRespones(204,tweet,"Tweet deleted Successfully"))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}