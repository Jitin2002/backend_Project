import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { Video } from "../models/video.models.js"
import { ApiRespones } from "../utils/ApiResponse.js"
import { isValidObjectId } from "mongoose"

const getAllVideos = asyncHandler(async(req,res)=>{
    const { 
        page =1,
        limit =10,        
        sortBy = "createdAt", 
        sortType = 1,       
    } = req.query;
    let getAllVideo;
    try {
        getAllVideo = await Video.aggregate([            
            {
                $sample : {
                    size : parseInt(limit),
                }
            },
            {
                $lookup :{
                    from : "users",
                    localField : "owner",
                    foreignField : "_id",
                    as : "details",
                    pipeline :[
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
                $addFields :{
                    details : {
                        $first :"$details"
                    }
                }
            },
            {
                $sort :{
                    [sortBy || "createdAt"] : sortType || 1
                }
            }
        ])
    } catch (error) {
        throw new ApiError(500,"Something went wrong while fetching Videos !!")
    }
    const result = await Video.aggregatePaginate(getAllVideo,{page,limit})
    if(result.docs.length ==0){
        return res.status(200).json(200,new ApiRespones(200, [], "No Video Found"));
    }
    return res
        .status(200)
        .json(new ApiRespones(200,result.docs,"Video fetched Successfully"))

})

const publishAVideo = asyncHandler(async (req,res) => {

    const {title , description} = req.body

    const videoLocalpath = req.files?.videoFile[0]?.path
    const thumbnailPath = req.files?.thumbnail[0]?.path

    if([title,description,videoLocalpath,thumbnailPath].some(
        (field)=>field?.trim() ===""
    )){
        throw new ApiError(400, "All fields are required")
    }
    
    const videoFile = await uploadOnCloudinary(videoLocalpath)
    const thumbnail = await uploadOnCloudinary(thumbnailPath)
    if(!videoFile) {
        throw new ApiError(400,"Error while uploading video on cloudinary")
    }
    if(!thumbnail){
        throw new ApiError(400,"Error while uploading thumbnail on cloudinary")

    }
    const video = await Video.create(
        {
            videoFile : videoFile.url,
            thumbnail : thumbnail.url,
            title,
            description,
            duration : videoFile.duration,
            isPublished : true,
            owner : req.user?._id,
        }
    )
    if(!video){
        throw new ApiError(500,"Something went wrong while ulpoading video")
    }
    return res
    .status(200)
    .json(new ApiRespones(200,video,"Video published Successfully."))
})

const getVideoById  = asyncHandler(async(req,res)=>{
    const {videoId} = req.params
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid Video ID")
    }
    const result = await Video.findById(videoId)
    console.log("Printing response of Video :",result);
    
    if(!result){
        throw new ApiError(400,"Failed to get video details")
    }
    return res  
        .status(200)
        .json(new ApiRespones(200,result,"Video details featched successfully"))
    
})

const updateVideo = asyncHandler(async(req,res)=>{
    const {videoId} = req.params
    const {title , description} = req.body
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid VideoId")
    }
    const thumbnailLocalPath = req.files?.path;
    if(!title && !description && !thumbnailLocalPath){
        throw new ApiError(400,"Atleast one field required !")
    }
    let thumbnail;
    if(thumbnailLocalPath){
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
        if(!thumbnail){
            throw new ApiError(400,"Error while updating thumbnail in cloudinary")
        }
    }
    const result = await Video.findByIdAndUpdate( 
        videoId,
        {
            $set :{
                title,
                description,
                thumbnail : thumbnail.url
            }
        },
        {
            new : true
        }
    )
    if(!result){
        throw new ApiError(400,"Video details not found")
    }
    return res  
        .status(200)
        .json(new ApiRespones(200,result,"Video details updated Successfully"))
})

const deleteVideo = asyncHandler(async(req,res) =>{
    const {videoId} = req.params
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid videoId")
    }
    const result = await Video.deleteOne({
        _id : ObjectID(`${videoId}`)
    })
    console.log("Printing delete response :",result);
    if(!result.acknowledged){
        throw new ApiError(400,"Error while deleting video from database")
    }
    return res  
        .status(200)
        .json(new ApiRespones(200,result,"Video deleted Successfully"))
})

const togglePublishState = asyncHandler(async(req,res)=>{
    const {videoId} = req.params;
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid VideoId")
    }
    const result = await Video.findById(videoId)
    if(!result){
        throw new ApiError(401, "Video not found")
    }
    result.isPublished = !result.isPublished
    await result.save({ validateBeforeSave: false })
    return res
    .status(200)
    .json(new ApiRespones(200,result,"Published video state toggled successfully"))
})
export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishState

}