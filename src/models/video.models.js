import mongoose, { model, Schema } from "mongoose";

import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";


const videoSchema = new Schema(
    {
        videoFile :{
            type: String ,   // cloudinary url 
            required : true
        },
        thumbnail :{
            type: String,
            required : true
        },
        owner : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "User"
        },
        title : {
            type : String,
            required : true
        },
        description : {
            type :String,
            required : true,
            
        },
        time : {
            type : Number, // cloudinary se hi mila ga  
            required : true
        },
        views : {
            type : Number,
            default : 0
        },
        isPublished : {
            type : Boolean,
            default : true
        }

    },{timestamps : true})

videoSchema.plugin(mongooseAggregatePaginate)
export const Video = model("Video",videoSchema)