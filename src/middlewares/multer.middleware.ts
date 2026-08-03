import { v2 as cloudinary } from "cloudinary";
import type { Request } from "express";
import type { FileFilterCallback } from "multer";
import multer from "multer";

// Custom multer storage engine that uploads file streams to Cloudinary (v2)
function cloudinaryStorage() {
  return {
    _handleFile(req: Request, file: any, cb: (error?: any, info?: any) => void) {
      let folder = "media";

      if (file.fieldname === "avatar") {
        folder = "avatars";
      } else if (file.mimetype.startsWith("video")) {
        folder = "videos";
      } else if (file.mimetype.startsWith("image")) {
        folder = "media";
      }

      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const public_id = file.fieldname + "-" + uniqueSuffix;
      const resource_type = file.mimetype.startsWith("video") ? "video" : "image";

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type, public_id },
        (error: any, result: any) => {
          if (error) return cb(error);
          cb(null, {
            path: result.secure_url,
            filename: result.public_id,
            size: result.bytes,
          });
        },
      );

      file.stream.pipe(uploadStream);
    },

    _removeFile(req: Request, file: any, cb: (error: any) => void) {
      const resource_type = file.mimetype && file.mimetype.startsWith("video") ? "video" : "image";
      cloudinary.uploader.destroy(file.filename, { resource_type }, (err: any) => cb(err));
    },
  } as any;
}

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
  storage: cloudinaryStorage(),
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB cap across all file types
  },
});