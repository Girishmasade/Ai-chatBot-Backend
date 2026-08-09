import { cloudinaryUrl } from "@/env/env.import.js";
import { v2 as cloudinary } from "cloudinary";

export const configCloud = async () => {
    cloudinary.config({
        cloudinary_url: cloudinaryUrl
    })
}