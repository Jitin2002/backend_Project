import { ApiRespones } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async(req,res) =>{
    return res.status(200)
    .json(new ApiRespones(200,"OK","Everything is OK"))
})

export {healthcheck}