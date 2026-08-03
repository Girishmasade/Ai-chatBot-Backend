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
    const response = await cloudinary.uploader.upload(filePath, {
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