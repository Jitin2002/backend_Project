import { asyncHandler } from "../utils/asyncHandler.js";
import { Playlist } from "../models/playlists.models.js"
import { ApiError } from "../utils/ApiError.js";
import mongoose, { isValidObjectId } from "mongoose";
import { ApiRespones } from "../utils/ApiResponse.js";
import { Video } from "../models/video.models.js"

const createPlaylist = asyncHandler(async(req,res)=>{
    const {name,description} = req.body
    if(!name || !description){
        throw new ApiError(401,"Both fields are required")
    }

    const list = await Playlist.create(
        {
            name,
            description,
            owner : req.user?._id
        }
    )
    if(!list) {
        throw new ApiError(500, "Something went wrong while making playlist")
    }

    return res
    .status(201)
    .json(
        new ApiRespones(201, list, "Playlist created succesfully.")
    )
})

const getUserPlaylists = asyncHandler(async(req,res)=>{
    const {userId} = req.params
    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invalid userId")
    }
    const result = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        },
        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"
                },
                totalViews: {
                    $sum: "$videos.views"
                }
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                totalVideos: 1,
                totalViews: 1,
                updatedAt: 1
            }
        }
    ])
    return res
    .status(200)
    .json(
        result.length ?
        new ApiRespones(200, result, "User playlist data fetched succesfully.")
        :
        new ApiRespones(200, [], "No playlist found.")

    )

})

const getPlaylistById = asyncHandler(async (req,res)=>{
    const {playlistId} = req.params
    if(!isValidObjectId(playlistId)){
        throw new ApiError(401, "Invalid playlistID")
    }
    const playlist = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
            }
        },
        {
            $match: {
                "videos.isPublished": true
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            }
        },
        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"
                },
                totalViews: {
                    $sum: "$videos.views"
                },
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1,
                totalVideos: 1,
                totalViews: 1,
                videos: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    createdAt: 1,
                    views: 1
                },
                owner: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1
                }
            }
        }
    ]);
    
    if(!playlist) {
        throw new ApiError(500, "Something went wrong while getting playlist.")
    }
    return res
        .status(200)
        .json(new ApiRespones(200,playlist[0],"Playlist sent successfully"))
});

const addVideoToPlaylist = asyncHandler(async(req,res)=>{
    const { videoId,playlistId } = req.params;

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlistId and videoId");
    }
    const playlist = await Playlist.findById(playlistId);
    const video = await Video.findById(videoId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }
    if (!video) {
        throw new ApiError(404, "video not found");
    }

    if (
        (playlist.owner?.toString() && video.owner.toString()) !==
        req.user?._id.toString()
    ) {
        throw new ApiError(400, "only owner can add video to thier playlist");
    }

    const updatedplaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet: {
            videos: videoId,
            },
        },
        {
            new: true,
        }
    );
  
    if (!updatedplaylist)
      throw new ApiError(500, "Error while adding video to playlist");
  
    return res
    .status(200)
    .json(
    new ApiRespones(200,updatedplaylist,"Video added to playlist successfully"))
});
    
const removeVideoFromPlaylist =  asyncHandler(async(req,res)=>{
    const { playlistId, videoId } = req.params;
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "plaese give valid video or playlist id");
    }
    const playlist = await Playlist.findById(playlistId);
    const video = await Video.findById(videoId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }
    if (!video) {
        throw new ApiError(404, "video not found");
    }

    if (
        (playlist.owner?.toString() && video.owner.toString()) !==
        req.user?._id.toString()
    ) {
        throw new ApiError(
            404,
            "only owner can remove video from thier playlist"
        );
    }
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId,
            },
        },
        {
            new: true,
        }
    );

    if (!updatedPlaylist)
        throw new ApiError(500, "Error while removing video from playlist");

    return res
    .status(200)
    .json(new ApiRespones(200,updatedPlaylist,"Video removed from playlist successfully")
    )
});

const deletePlaylist = asyncHandler(async(req,res)=>{
    const { playlistId } = req.params;
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");
    }
    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(400, "only owner can delete the playlist");
    }
    const Delplaylist = await Playlist.findByIdAndDelete(playlistId);

    if (!Delplaylist) throw new ApiError(500, "Error while deleting Playlist !");

    return res
    .status(200)
    .json(new ApiRespones(200, {}, "Playlist deleted successfully"))
});

const updatePlaylist = asyncHandler(async(req,res)=>{
    const {playlistId} = req.params
    if(!isValidObjectId(playlistId)){
        throw new ApiError(400,"invalid playlistId")
    }
    const {name, description}= req.body
    if(!(name || description)){
        throw new ApiError(401,"Atleast one field is required")
    }
    const updateFields = {};
    if (name) updateFields.name = name;
    if (description) updateFields.description = description;
    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set:updateFields        
        },
        { new : true}
    )
    if(!playlist){
        throw new ApiError(500, "Something went wrong while updating playlist")
    }
    return res
    .status(200)
    .json(new ApiRespones(200,playlist,"Playlist updates successfully"))
});



export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}