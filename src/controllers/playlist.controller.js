import { asyncHandler } from "../utils/asyncHandler.js";
import { Playlist } from "../models/playlists.models.js"
import { ApiError } from "../utils/ApiError.js";
import mongoose, { isValidObjectId } from "mongoose";
import { ApiRespones } from "../utils/ApiResponse";


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
    .status(200)
    .json(
        new ApiRespones(200, list, "Playlist created succesfully.")
    )
})

const getUserPlaylists = asyncHandler(async(req,res)=>{
    const {userId} = req.params
    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invalid userId")
    }
    const result = await Playlist.aggregate([
        {
            $match :{
                owner : new mongoose.Types.ObjectId(userId)                
            }
        },
        {
            $lookup :{
                from :"users",
                localField :"owner",
                foreignField:"_id",
                as :"owner",
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
            $lookup :{
                from:"videos",
                localField :"videos",
                foreignField: "_id",
                as :"videos",
                pipeline :[
                    {
                        $project:{
                            thumbnail :1,
                            views :1,
                        }
                    }
                ]
            }
        },
        {
            $unwind :"$owner",
        },
        {
            $project:{
                name :1,
                description:1,
                owner :1,
                thumbnail:1,
                videoCount : 1,
                createdAt :1,
                updatedAt :1,
                thumbnail :{
                    $first : "$videos.thumbnail",
                },
                videoCount : {
                    $size : "$videos",
                },
                totalViews : {
                    $sum : "$videos.views"
                }
            }
        }
    ])
    return res
    .status(200)
    .json(
        result.length ?
        new ApiRespones(200, result, "User playlist data fetched succesfully.")
        :
        new ApiRespones(200, result, "No playlist found.")

    )

})

const getPlaylistById = asyncHandler(async (req,res)=>{
    const {playlistId} = req.params
    if(!isValidObjectId(playlistId)){
        throw new ApiError(401, "Invalid playlistID")
    }
    const playlist = await Playlist.aggregate([
        {
            $match :{
                _id : new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup :{
                from :"videos",
                localField :"videos",
                foreignField :"_id",
                as : "videos",
                pipeline:[
                    {
                        $match :{isPublished : true}
                    },
                    {
                        $lookup:{
                            from :"users",
                            localField :"owner",
                            foreignField :"_id",
                            as : "owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname : 1,
                                        avatar :1,
                                        username :1
                                    }
                                }
                            ]
                            
                        }
                    },
                    {
                        $addFields :{
                            owner :{
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        },
        {
            $lookup:{
                from :"users",
                localField:"owner",
                foreignField :"_id",
                as :"owner",
                pipeline :[
                    {
                        $project:{
                            username:1,
                            fullname:1,
                            avatar:1
                        }
                    }
                ]
            }
        },
        {
            $addFields :{
                owner :{
                    $first :"$owner"
                }
            }
        },
        {
            $project:{
                name :1,
                description:1,
                videos:1,
                owner :1,
                thumbnail:1,
                videoCount:1,
                createdAt:1,
                updatedAt:1,
                thumbnail:{
                    $first :"$videos.thumbnail",
                },
                videoCount:{
                    $size :"$videos"
                },
                totalViews :{
                    $sum :"$videos.views"
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
    const { playlistId, videoId } = req.params;

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlistId and videoId");
    }
  
    const playlist = await Playlist.findByIdAndUpdate(
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
  
    if (!playlist)
      throw new ApiError(500, "Error while adding video to playlist");
  
    return res
    .status(200)
    .json(
    new ApiRespones(200,{ isAdded: true },"Video added to playlist successfully"))
});
    
const removeVideoFromPlaylist =  asyncHandler(async(req,res)=>{
    const { playlistId, videoId } = req.params;
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "plaese give valid video or playlist id");
    }

    const playlist = await Playlist.findByIdAndUpdate(
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

    if (!playlist)
        throw new ApiError(500, "Error while removing video from playlist");

    return res
    .status(200)
    .json(new ApiRespones(200,{ isSuccess: true },"Video removed from playlist successfully")
    )
});

const deletePlaylist = asyncHandler(async(req,res)=>{
    const { playlistId } = req.params;
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid PlaylistId");
    }
    const playlist = await Playlist.findByIdAndDelete(playlistId);

    if (!playlist) throw new ApiError(500, "Error while deleting Playlist !");

    return res
    .status(200)
    .json(new ApiRespones(200, playlist, "Playlist deleted successfully"))
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
    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set:{
                name,
                description
            },            
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