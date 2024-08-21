// require("dotenv").config({path: './env'})  // you can improve  it more
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";
dotenv.config({
    path : './.env'
})

connectDB()
.then(()=>{
    app.on("error",(err)=>{
        console.log("ERROR:",err);
        throw err        
    })
    
    app.listen(process.env.PORT || 8000 , ()=>{
        console.log(`* Server is running at port : ${process.env.PORT}`);
        
    })
})
.catch((err) =>{
    console.log("MONGODB connect failed !!!",err);
})






/*
import { DB_NAME } from "./constants"; 

import express from "express"
const app = express()
//ife immediately execute krr do
;(async ()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log("ERROR :",error); 
            throw error
        })
        app.listen(process.env.PORT,()=>{
            console.log(`App is listening on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("Error : ",error);
        throw error
    }
}) () 
*/