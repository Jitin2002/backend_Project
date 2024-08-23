import mongoose, { isValidObjectId } from "mongoose";
import {Comment} from "../models/comments.models.js"
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiRespones } from "../utils/ApiResponse.js";
import { Video} from "../models/video.models.js"
import { Like } from "../models/likes.models.js";
const getVideoComments = asyncHandler(async(req,res)=>{
    const {videoId} = req.params
    const {page =1,limit =10} =req.query
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }
    const commentsAggregate = Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullname: 1,
                    "avatar.url": 1
                },
                isLiked: 1
            }
        }
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const comments = await Comment.aggregatePaginate(
        commentsAggregate,
        options
    );

    if(comments.docs.length ==0){
        return res.status(200).json(new ApiRespones(200,[],"No Comment Found"))
    }
    return res
    .status(200)
    .json(new ApiRespones(200,comments.docs,"Comments fetched Successfully"))
})

const addComment = asyncHandler(async(req,res)=>{
    const { videoId } = req.params;
    const { content } = req.body;
    if(!content){
        throw new ApiError(400,"Content is required")
    }
    
    

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    });

    if (!comment) {
        throw new ApiError(500, "Failed to add comment please try again");
    }

    return res
        .status(201)
        .json(new ApiRespones(201, comment, "Comment added successfully"));
})

const updateComment = asyncHandler(async(req,res) =>{
    const {commentId} = req.params
    const {content} = req.body
    if(content?.trim()===""){
        throw new ApiError(400,"Empty comment not allowed")
    }
    if(!isValidObjectId(commentId)){
        throw new ApiError(401, "Invalid commentID") 
    }
    const result = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set :{
                content
            }
        },
        {
            new :true
        }
    )
    if(!result){
        throw new ApiError(400,"Something went wrong while updating comment")       
    }
    return res
    .status(200)
    .json(new ApiRespones(200,result,"Successfully Updated Comment"))

})

const deleteComment  = asyncHandler(async(req,res)=>{
    const {commentId} = req.params
    if(!isValidObjectId(commentId)){
        throw new ApiError(400,"Invalid commentId")

    }
    const result = await Comment.findByIdAndDelete(commentId)
    await Like.deleteMany({
        comment: commentId,
        likedBy: req.user
    });

    if(!result){
        throw new ApiError(400, "Something went wrong while Deleting comment.")  
    }
    return res
    .status(200)
    .json(new ApiRespones(200,{},"Successfully deleted comment"))
})
export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}