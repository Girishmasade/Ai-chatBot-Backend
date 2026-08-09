import { AsyncHandler } from "@/utils/AsyncHandler.js";
import { createCacheHelper } from "@/utils/redis.util.js";
import { TokenPackage } from "./token.model.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { successHandler } from "@/utils/successHandler.util.js";
import {
  DEFAULT_LIMIT,
  paginate,
  parsePaginationParams,
  type PaginatedResult,
} from "@/helper/pagination.helper.js";
import { TokenPackageStatus } from "./token.type.js";

// token package redis cache

const tokenPackageCache = createCacheHelper({
  namespace: "token_packages",
  ttl: 300,
});

// console.log("token package cache :", tokenPackageCache)

// create a token

export const CreateToken = AsyncHandler(async (req, res, next) => {
  try {
    const {
      name,
      description,
      tokenAmount,
      price,
      currency,
      status,
      sortOrder,
      isPopular,
    } = req.body;

    const existing = await TokenPackage.findOne({ name });

    if (existing) {
      return errorHandler(
        res,
        400,
        false,
        "Token Package Already Exists",
        next,
      );
    }

    const tokenPackageCreate = await TokenPackage.create({
      name,
      description,
      tokenAmount,
      price,
      currency: currency,
      status: status,
      isPopular,
      sortOrder,
    });

    await tokenPackageCache.invalidate();

    // console.log("token package create :", tokenPackageCreate);

    successHandler(res, 201, true, `Token package for ${name} is created`, {
      tokenPackageCreate,
    });
  } catch (error) {
    console.error("Error in CreateToken: ", error);
    next(error);
  }
});

// get All packages

export const getAllPackages = AsyncHandler(async (req, res, next) => {
  try {
    const { status, isPopular, minPrice, maxPrice, minTokens, maxTokens } =
      req.query;

    const { page, limit, sort, sortBy, sortOrder } = parsePaginationParams(
      req.query,
      {
        defaultSortBy: "sortOrder",
        defaultSortOrder: "asc",
        allowedSortFields: ["price", "tokenAmount", "sortOrder", "createdAt"],
      },
    );

    // Only cache the unfiltered, default-sorted, first-page listing
    const isDefaultQuery =
      !status &&
      !isPopular &&
      !minPrice &&
      !maxPrice &&
      !minTokens &&
      !maxTokens &&
      page === 1 &&
      limit === DEFAULT_LIMIT &&
      sortBy === "sortOrder" &&
      sortOrder === "asc";

    if (isDefaultQuery) {
      const cached = await tokenPackageCache.get<
        PaginatedResult<Record<string, unknown>>
      >(tokenPackageCache.keys.all);
      if (cached) {
        return successHandler(
          res,
          200,
          true,
          "Token packages fetched successfully (cached)",
          { cached },
        );
      }
    }

    const filter: Record<string, any> = {};

    if (status) filter.status = status;
    if (isPopular !== undefined) filter.isPopular = isPopular === "true";
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (minTokens || maxTokens) {
      filter.tokenAmount = {};
      if (minTokens) filter.tokenAmount.$gte = Number(minTokens);
      if (maxTokens) filter.tokenAmount.$lte = Number(maxTokens);
    }

    const result = await paginate(TokenPackage, filter, { page, limit, sort });

    // console.log("result ", result);

    if (isDefaultQuery) {
      await tokenPackageCache.set(tokenPackageCache.keys.all, result);
    }

    return successHandler(
      res,
      200,
      true,
      "Token packages fetched successfully",
      { result },
    );
  } catch (error) {
    console.error("Error in getAllPackages: ", error);
    next(error);
  }
});

// active token package

export const activeTokenPackage = AsyncHandler(async (req, res, next) => {
  try {
    const cache = await tokenPackageCache.get(tokenPackageCache.keys.active);
    if (cache) {
     return successHandler(
        res,
        200,
        true,
        "Token packages fetched successfully (cached)",
        { cache },
      );
    }

    const packages = await TokenPackage.find({
      status: TokenPackageStatus.ACTIVE,
    })
      .sort({ sortOrder: 1 })
      .lean();

    // console.log("packages :", packages);

    await tokenPackageCache.set(tokenPackageCache.keys.active, packages);

   return successHandler(res, 200, true, "Token packages fetched successfully", {packages});
  } catch (error) {
    console.error("error in active token package", error);
    next(error);
  }
});

// token modlation package by id

export const getTokenPackageById = AsyncHandler(async (req, res, next) => {
  try {
    const tokenId = req.params.tokenId as string;

    if (!tokenId) {
      errorHandler(res, 404, false, "Token id is required", {});
    }

    const cached = await tokenPackageCache.get(
      tokenPackageCache.keys.byId(tokenId),
    );

    if (cached) {
      return successHandler(
        res,
        200,
        false,
        "Token package fetched successfully",
        { cached },
      );
    }

    const packageById = await TokenPackage.findById(tokenId).lean();

    if (!packageById) {
      errorHandler(res, 404, false, "Token package not found", {});
    }

    // console.log("package :", packageById);

    await tokenPackageCache.set(
      tokenPackageCache.keys.byId(tokenId),
      packageById,
    );

    return successHandler(
      res,
      200,
      true,
      "Token package fetched successfully",
      { packageById },
    );
  } catch (error) {
    console.error("error in get token package by id", error);
    next(error);
  }
});

// update the token package

export const updateTokenPackage = AsyncHandler(async (req, res, next) => {
  try {
    const tokenId = req.params.tokenId as string;
    const updates = req.body;

    if (!tokenId) {
      errorHandler(res, 404, false, "TokenId is required", {});
    }

    if (updates.name) {
      const conflict = await TokenPackage.findOne({
        name: updates.name,
        _id: { $ne: tokenId },
      });

      if (conflict) {
        errorHandler(
          res,
          409,
          false,
          "Another token package with this name already exists",
          {},
        );
      }
    }

    const tokenPackage = await TokenPackage.findByIdAndUpdate(
      tokenId,
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    // console.log("token Package :", tokenPackage);

    if (!tokenPackage) {
      return errorHandler(res, 404, false, "Token package not found", {});
    }

    // Refresh the single-record cache in place; invalidate list/active caches
    await tokenPackageCache.update(tokenId, tokenPackage);
    await tokenPackageCache.invalidateKeys([]);

    return successHandler(
      res,
      200,
      true,
      "Token package updated successfully",
      { tokenPackage },
    );
  } catch (error) {
    console.error("error in update token package", error);
    next(error);
  }
});

// toggle token package status

export const toggleTokenPackageStatus = AsyncHandler(
  async (req, res, next) => {
    const tokenId = req.params.tokenId as string;
    const { status } = req.body;
 
    const tokenPackage = await TokenPackage.findByIdAndUpdate(
      tokenId,
      { $set: { status } },
      { new: true, runValidators: true }
    ).lean();
 
    if (!tokenPackage) {
      return errorHandler(res, 404, false, "Token package not found", {});
    }
 
    // console.log("token package :", tokenPackage)

    await tokenPackageCache.update(tokenId, tokenPackage);
    await tokenPackageCache.invalidateKeys([]);
 
    return successHandler(
      res,
      200,
      true,
      `Token package status updated to ${status}`,
      {tokenPackage}
    );
  }
);

// delete token package 

export const deleteTokenPackage = AsyncHandler(
  async (req, res, next) => {
   try {
     const tokenId = req.params.tokenId as string ;
 
    const tokenPackage = await TokenPackage.findByIdAndDelete(tokenId).lean();
    if (!tokenPackage) {
      return errorHandler(res, 404, false, "Token package not found", {});
    }
 
    await tokenPackageCache.invalidate(tokenId);
 
    return successHandler(res, 200, true, "Token package deleted successfully", {});
   } catch (error) {
    console.error("error in delete token package", error);
    next(error);
   }
  }
);