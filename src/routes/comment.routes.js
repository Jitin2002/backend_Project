import { Router } from 'express';
import { upload } from '../middlewares/multer.middleware.js';
import {
    addComment,
    deleteComment,
    getVideoComments,
    updateComment,   
} from "../controllers/comment.controller.js"
import {verifyJWT} from "../middlewares/auth.middelware.js"

const router = Router();

router.use(verifyJWT,upload.none()); // Apply verifyJWT middleware to all routes in this file

router.route("/:videoId").get(getVideoComments).post(addComment);
router.route("/c/:commentId").delete(deleteComment).patch(updateComment);

export default router