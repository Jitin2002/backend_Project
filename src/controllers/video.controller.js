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
        query = "",
        userId = "",        
        sortBy = "createdAt", 
        sortType = 1,       
    } = req.query;
    
    try {
        const videoAggregate = await Video.aggregate([            
            {
                $match: {
                    $or: [
                        { title: { $regex: query, $options: "i" } }, //case-insensitive
                        { description: { $regex: query, $options: "i" } }
                    ]
                }
            },
            {
                $lookup :{
                    from : "users",
                    localField : "owner",
                    foreignField : "_id",
                    as : "owner",
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
                    owner : {
                        $first :"$owner"
                    }
                }
            },
            {
                $sort :{
                    [sortBy ] : sortType 
                }
            }
        ]);

        const options = { // Define the pagination behavior
            page,
            limit,
            customLabels: { // Changes the default field names 
                totalDocs: "totalVideos",
                docs: "videos",
    
            },
            skip: (page - 1) * limit,
            limit: parseInt(limit),
        }

        const result = await Video.aggregatePaginate(videoAggregate, options);

        if (!result.videos.length) {
            return res
            .status(200)
            .json(new ApiRespones(200, [], "No videos found"));
        }

        return res
        .status(200)
        .json(new ApiRespones(200, result, "Videos fetched successfully"));

    } catch (error) {
        throw new ApiError(500, error.message ||"Internal server error in video aggregation")
    }  
    
});

const publishAVideo = asyncHandler(async (req,res) => {

    const {title , description} = req.body
    // validation
    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required.");
    }
    const videoLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    if (!videoLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "Both video and thumbnail files are required.");
    }    
    
    const videoFile = await uploadOnCloudinary(videoLocalPath)
    const thumbnailFile = await uploadOnCloudinary(thumbnailLocalPath)
    if(!videoFile) {
        throw new ApiError(400,"Error while uploading video on cloudinary")
    }
    if(!thumbnailFile){
        throw new ApiError(400,"Error while uploading thumbnail on cloudinary")

    }
    const video = await Video.create(
        {
            videoFile : videoFile.url,
            thumbnail : thumbnailFile.url,
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
    .status(201)
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
        throw new ApiError(404,"Video not found")
    }
    return res  
        .status(200)
        .json(new ApiRespones(200,result,"Video  fetched successfully"))
    
})


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    // Validate video ID
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if (!title && !description && !req.file?.path) {
        throw new ApiError(400, "At least one field (title, description, or thumbnail) is required.");
    }

    // Find the existing video
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Prepare the updated data object
    const updatedVideoData = {};
    if (title) updatedVideoData.title = title;
    if (description) updatedVideoData.description = description;

    // Handle thumbnail update if a new file is provided
    if (req.file?.path) {
        // Delete the old thumbnail from Cloudinary
        if (video.thumbnail) {
            await destroyCloudImage(video.thumbnail);
        }

        // Upload the new thumbnail to Cloudinary
        const thumbnailUpload = await uploadOnCloudinary(req.file.path);
        if (!thumbnailUpload?.url) {
            throw new ApiError(400, "Error while uploading the new thumbnail.");
        }

        updatedVideoData.thumbnail = thumbnailUpload.url           
        
    }

    // Update the video in the database
    const updatedVideo = await Video.findByIdAndUpdate(videoId, updatedVideoData, {
        new: true, // Return the updated document
    });

    if (!updatedVideo) {
        throw new ApiError(500, "Error updating the video details.");
    }

    // Respond with the updated video details
    return res
    .status(200)
    .json(new ApiRespones(200, updatedVideo, "Video details updated successfully."));
});


const deleteVideo = asyncHandler(async(req,res) =>{
    const {videoId} = req.params
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid videoId")
    }
    const video =  await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "No video found");
    }
    await destroyCloudImage(video.thumbnail)

    await destroyCloudVideo(video.videoFile)
    await Like.deleteMany({
        video: videoId
    })
    const result = await Video.findByIdAndDelete(videoId)

    
    if(!result.acknowledged){
        throw new ApiError(400,"Error while deleting video from database")
    }
    return res  
        .status(200)
        .json(new ApiRespones(200,{},"Video Deleted Successfully"))
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