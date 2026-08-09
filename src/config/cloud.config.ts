import { cloudinaryUrl } from "../env/env.import.js";
import { v2 as cloudinary } from "cloudinary";

export const configCloud = () => {
  const url = cloudinaryUrl || process.env.CLOUDINARY_URL;
  if (url) {
    process.env.CLOUDINARY_URL = url;
    try {
      const matches = url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
      if (matches) {
        const [, api_key, api_secret, cloud_name] = matches;
        cloudinary.config({
          cloud_name,
          api_key,
          api_secret,
          secure: true,
        });
        console.log(`[Cloudinary] Configured successfully for cloud_name: ${cloud_name}`);
        return;
      }
    } catch (e) {
      console.error("[Cloudinary] Error parsing URL:", e);
    }
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
};