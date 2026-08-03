import { Document, Model, type FilterQuery, type SortOrder } from "mongoose";
/**
 * Generic pagination helper.
 *
 * Provides:
 * - `parsePaginationParams` — normalize page/limit/sort query params with safe defaults & caps
 * - `buildPaginationMeta`   — build the `pagination` object for API responses
 * - `paginate`              — run a find + countDocuments query against any Mongoose model
 *
 * Usage:
 * ```ts
 * const { page, limit, skip, sortBy, sortOrder } = parsePaginationParams(req.query, {
 *   defaultSortBy: "sortOrder",
 *   allowedSortFields: ["price", "tokenAmount", "sortOrder", "createdAt"],
 * });
 *
 * const result = await paginate(TokenPackage, filter, {
 *   page, limit, sortBy, sortOrder,
 * });
 *
 * return successHandler(res, 200, "Fetched successfully", result);
 * // result = { data: [...], pagination: { total, page, limit, totalPages, hasNextPage, hasPrevPage } }
 * ```
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type SortDirection = "asc" | "desc";

export interface RawPaginationQuery {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: SortDirection;
  sort: Record<string, SortOrder>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ParsePaginationOptions {
  /** Default sort field when none/invalid is provided. */
  defaultSortBy?: string;
  /** Default sort direction. Defaults to "asc". */
  defaultSortOrder?: SortDirection;
  /** Whitelist of fields allowed to sort by. If provided, invalid values fall back to defaultSortBy. */
  allowedSortFields?: readonly string[];
  /** Override the default page size (20). */
  defaultLimit?: number;
  /** Override the max allowed page size (100). */
  maxLimit?: number;
}

// ─── Parse Query Params ──────────────────────────────────────────────────────

/**
 * Normalize raw query params (`page`, `limit`, `sortBy`, `sortOrder`) into
 * safe, bounded values plus a ready-to-use Mongoose `sort` object.
 */
export const parsePaginationParams = (
  query: RawPaginationQuery,
  options: ParsePaginationOptions = {}
): PaginationParams => {
  const {
    defaultSortBy = "createdAt",
    defaultSortOrder = "desc",
    allowedSortFields,
    defaultLimit = DEFAULT_LIMIT,
    maxLimit = MAX_LIMIT,
  } = options;

  let page = Number(query.page);
  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE;

  let limit = Number(query.limit);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  let sortBy = (query.sortBy ?? defaultSortBy) as string;
  if (allowedSortFields && !allowedSortFields.includes(sortBy)) {
    sortBy = defaultSortBy;
  }

  const sortOrder: SortDirection =
    query.sortOrder === "asc" || query.sortOrder === "desc"
      ? query.sortOrder
      : defaultSortOrder;

  const skip = (page - 1) * limit;

  const sort: Record<string, SortOrder> = {
    [sortBy]: sortOrder === "desc" ? -1 : 1,
  };

  return { page, limit, skip, sortBy, sortOrder, sort };
};

// ─── Build Meta ──────────────────────────────────────────────────────────────

/**
 * Build the standard `pagination` block included in paginated API responses.
 */
export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

// ─── Run Paginated Query ─────────────────────────────────────────────────────

export interface PaginateOptions {
  page: number;
  limit: number;
  sort?: Record<string, SortOrder>;
  /** Fields to select, e.g. "name price -description". Omit to return all fields. */
  select?: string;
  /** Population options, passed through to `.populate()`. */
  populate?: string | string[] | Record<string, unknown>;
}

/**
 * Run a paginated `find` + `countDocuments` against any Mongoose model.
 * Returns `.lean()` documents for performance.
 */
export const paginate = async <T>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: PaginateOptions
): Promise<PaginatedResult<Record<string, unknown>>> => {
  const { page, limit, sort, select, populate } = options;
  const skip = (page - 1) * limit;

  let query = model.find(filter);

  if (sort) query = query.sort(sort);
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate as never);

  const [data, total] = await Promise.all([
    query.skip(skip).limit(limit).lean(),
    model.countDocuments(filter),
  ]);

  return {
    data: data as unknown as Record<string, unknown>[],
    pagination: buildPaginationMeta(total, page, limit),
  };
};