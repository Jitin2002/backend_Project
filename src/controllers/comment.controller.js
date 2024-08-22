import mongoose, { isValidObjectId } from "mongoose";
import {Comment} from "../models/comments.models.js"
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiRespones } from "../utils/ApiResponse.js";

const getVideoComments = asyncHandler(async(req,res)=>{
    const {videoId} = req.params
    const {page =1,limit =10} =req.query

    let getAllComments;
    try {
        getAllComments = Comment.aggregate([
            {
                $match : {
                    video : new mongoose.Types.ObjectId(videoId)
                },
            },
            {
                $lookup :{
                    from : "users",
                    localField : "owner",
                    foreignField:"_id",
                    as : "details",
                    pipeline:[
                        {
                            $project :{
                                fullname :1,
                                avatar :1,
                                username :1
                            }
                        }
                        
                    ]
                }
            },
            {
                $lookup :{
                    from :"likes",
                    localField :"owner",
                    foreignField :"likedBy",
                    as :"likes",
                    pipeline:[
                        {
                            $match:{
                                comment : {$exists : true}
                            }
                        }
                    ]
                }
            },
            {
                $addFields:{
                    details :{
                        $first :"$details"
                    }
                }
            },
            {
                $addFields:{
                    likes :{
                        $first: {$size :"$likes"}
                    }
                }
            },
            {
                $skip :(page - 1)*limit,
            },
            {
                $limit: parseInt(limit)
            }            
        ])
    } catch (error) {
        throw new ApiError(500,"Something went wrong fetching comments")
    }

    const result = await Comment.aggregatePaginate(getAllComments,{page,limit})

    if(result.docs.length ==0){
        return res.status(200).json(new ApiRespones(200,[],"No Comment Found"))
    }
    return res
    .status(200)
    .json(new ApiRespones(200,result.docs,"Comments fetched Successfully"))
})

const addComment = asyncHandler(async(req,res)=>{
    const {videoId} = req.params
    const {content} = req.body

    if(!isValidObjectId(videoId)){
        throw new ApiError(401, "Invalid videoID")
    }
    const result = await Comment.create(
        {
            content,
            video : videoId,
            owner : req.user?._id
        }
    )
    if(!result) {
        throw new ApiError(401, "Invalid videoID")
    }
    return res
    .status(200)
    .json(new ApiRespones(200,result,"Successfully comment added"))
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
    const result = await Comment.findOneAndDelete(commentId)
    if(!result){
        throw new ApiError(400, "Something went wrong while Deleting comment.")  
    }
    return res
    .status(200)
    .json(new ApiRespones(200,result,"Successfully deleted comment"))
})
export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}