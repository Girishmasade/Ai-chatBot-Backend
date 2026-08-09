import { v2 as cloudinary } from "cloudinary";

type FileType = "image" | "video" | "raw" | "auto";

interface UploadFiles {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string;
  bytes: number;
}

interface DeleteResponse {
  result: "ok" | "not found"; 
}

// Upload (works for both image & video via "auto") 

export const uploadFile = async (
  filePath: string,
  folder: string = "media",
  resourceType: FileType = "auto", 
): Promise<UploadFiles> => {                
  try {
    let targetPayload = filePath;

    // If filePath is a remote HTTP URL, fetch the buffer locally first to prevent 403 CDN blockages
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      if (!filePath.includes("res.cloudinary.com")) {
        try {
          const fetchRes = await fetch(filePath, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (fetchRes.ok) {
            const arrayBuffer = await fetchRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = fetchRes.headers.get("content-type") || (resourceType === "video" ? "video/mp4" : "image/jpeg");
            targetPayload = `data:${contentType};base64,${buffer.toString("base64")}`;
          }
        } catch (fetchErr: any) {
          console.warn(`[Cloudinary] Buffer fetch warning for ${filePath}: ${fetchErr?.message}`);
        }
      }
    }

    const response = await cloudinary.uploader.upload(targetPayload, {
      folder,
      resource_type: resourceType,
    });

    return {
      public_id: response.public_id,
      secure_url: response.secure_url,
      resource_type: response.resource_type,
      format: response.format,
      bytes: response.bytes,
    };
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${(error as Error).message}`);
  }
};

// Delete (works for both image & video, pass the correct resourceType) 

export const deleteFile = async (
  publicId: string,
  resourceType: FileType = "image",
): Promise<DeleteResponse> => {
  try {
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (response.result === "not found") {
      throw new Error(`File not found on Cloudinary: ${publicId}`);
    }

    return response;
  } catch (error) {
    throw new Error(`Cloudinary delete failed: ${(error as Error).message}`);
  }
};

// Extract public_id from a Cloudinary URL

export const extractPublicId = (cloudinaryUrl: string): string => {
  const parts = cloudinaryUrl.split("/");
  const uploadIndex = parts.indexOf("upload");

  // skip the version segment (v1234567) if present
  const startIndex = parts[uploadIndex + 1]?.startsWith("v")
    ? uploadIndex + 2
    : uploadIndex + 1;

  const publicIdWithExt = parts.slice(startIndex).join("/");
  return publicIdWithExt.replace(/\.[^/.]+$/, ""); // strip file extension
};

// Safe Cloudinary Uploader for AI Generated Assets
export const uploadMediaToCloudinary = async (
  contentUrlOrBase64: string,
  folder: string = "ai_assets",
  resourceType: FileType = "auto"
): Promise<string> => {
  if (!contentUrlOrBase64) return contentUrlOrBase64;

  // Auto-detect video if resourceType is auto
  let targetResourceType: FileType = resourceType;
  const isVideoContent =
    contentUrlOrBase64.startsWith("data:video/") ||
    contentUrlOrBase64.endsWith(".mp4") ||
    contentUrlOrBase64.endsWith(".webm") ||
    contentUrlOrBase64.includes("/video/upload/") ||
    contentUrlOrBase64.includes("gtv-videos-bucket") ||
    contentUrlOrBase64.includes("googleapis.com");

  if (targetResourceType === "auto" && isVideoContent) {
    targetResourceType = "video";
  }

  // Route video files into the video subfolder (e.g. ai_assets/video)
  let targetFolder = folder;
  if (targetResourceType === "video" || isVideoContent) {
    targetFolder = folder.endsWith("/video") ? folder : `${folder}/video`;
  }

  // If it's already on Cloudinary with correct resource type, return as is
  if (contentUrlOrBase64.includes("res.cloudinary.com")) {
    if (targetResourceType === "video" && contentUrlOrBase64.includes("/image/upload/")) {
      // Re-upload video if it was previously mis-classified as image
    } else {
      return contentUrlOrBase64;
    }
  }

  try {
    const uploadRes = await uploadFile(contentUrlOrBase64, targetFolder, targetResourceType);
    if (uploadRes?.secure_url) {
      console.log(`[Cloudinary] Successfully stored ${targetResourceType} asset on Cloudinary: ${uploadRes.secure_url}`);
      return uploadRes.secure_url;
    }
  } catch (err: any) {
    console.warn(`⚠️ [Cloudinary] Media upload warning: ${err?.message}`);
  }

  return contentUrlOrBase64;
};