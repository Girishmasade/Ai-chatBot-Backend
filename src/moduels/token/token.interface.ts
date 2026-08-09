import { Document } from "mongoose";
import { TokenPackageStatus, TokenPackageCurrency } from "./token.type.js";

export interface ITokenDocument extends Document {
  name: string;
  description?: string;
  tokenAmount: number;
  price: number;
  currency: TokenPackageCurrency;
  status: TokenPackageStatus;
  isPopular: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
