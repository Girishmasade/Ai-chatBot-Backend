export enum TokenPackageStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

export enum TokenPackageCurrency {
  INR = "inr",
  USD = "usd",
  EUR = "eur",
}

export interface ITokenPackage {
  _id: string;
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

export interface CreateTokenPackageDTO {
  name: string;
  description?: string;
  tokenAmount: number;
  price: number;
  currency?: TokenPackageCurrency;
  status?: TokenPackageStatus;
  isPopular?: boolean;
  sortOrder?: number;
}

export interface UpdateTokenPackageDTO extends Partial<CreateTokenPackageDTO> {}

export interface TokenPackageQuery {
  status?: TokenPackageStatus;
  isPopular?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minTokens?: number;
  maxTokens?: number;
  page?: number;
  limit?: number;
  sortBy?: "price" | "tokenAmount" | "sortOrder" | "createdAt";
  sortOrder?: "asc" | "desc";
}