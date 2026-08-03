import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import type { Request } from "express";
import type { FileFilterCallback } from "multer";
import multer from "multer";

// 

const uploadFilesMiddleware = new CloudinaryStorage({
  cloudinary,
  params: async (req: Request, file: Express.Multer.File) => {
    let folder = "media"; // default

    if (file.fieldname === "avatar") {
      folder = "avatars";
    } else if (file.mimetype.startsWith("video")) {
      folder = "videos";
    } else if (file.mimetype.startsWith("image")) {
      folder = "media";
    }

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    return {
      folder,
      resource_type: file.mimetype.startsWith("video") ? "video" : "image",
      public_id: file.fieldname + "-" + uniqueSuffix,
    };
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (file.fieldname === "avatar") {
    const allowed = ["image/jpeg", "image/png", "image/svg"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Avatar must be an image"));
    }
  }

  if (file.fieldname === "video") {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files allowed"));
    }
  }

  if (file.fieldname === "media") {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Media must be images"));
    }
  }

  cb(null, true);
};

export const upload = multer({
  storage: uploadFilesMiddleware,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB cap across all file types
  },
});