import { Router } from "express";
import {
  activeTokenPackage,
  CreateToken,
  deleteTokenPackage,
  getAllPackages,
  getTokenPackageById,
  toggleTokenPackageStatus,
  updateTokenPackage,
} from "./token.controller.js";

export const tokenPackageRoute = Router();

tokenPackageRoute.get("/active", activeTokenPackage);
tokenPackageRoute.post("/create-token", CreateToken);
tokenPackageRoute.get("/get-all-token", getAllPackages);
tokenPackageRoute.get("/get/:tokenId/token", getTokenPackageById);
tokenPackageRoute.put("/update/:tokenId/token", updateTokenPackage);
tokenPackageRoute.patch("/toggle/:tokenId/token", toggleTokenPackageStatus);
tokenPackageRoute.delete("/delete/:tokenId/token", deleteTokenPackage);
