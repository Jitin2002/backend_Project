import { v2 as cloudinary } from "cloudinary";

import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (loaclFilePath) => {
  try {
    if (!loaclFilePath) return null;
    // upload the file on the cloudinary
    const response = await cloudinary.uploader.upload(loaclFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfully
    // console.log("file is uploaded on cloudinary ", response.url);
    fs.unlinkSync(loaclFilePath) // after uploading successfully remove 
    return response;
  } catch (error) {
    fs.unlinkSync(loaclFilePath); // remove the locally saved temp file as the upload operation got failed
    return null;
  }
};
const deleteOnCloudinary = async (url, resource_type="image") => {
  try {
      if (!url) return null;

      //delete file from cloudinary
      const result = await cloudinary.uploader.destroy(url, {
          resource_type: `${resource_type}`
      });
  } catch (error) {
      return error;
      console.log("delete on cloudinary failed", error);
  }
};

export { uploadOnCloudinary, deleteOnCloudinary };

