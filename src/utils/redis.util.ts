import redisClient from "@/config/redis.config.js";

/**
 * Generic Redis cache helper factory.
 *
 * Each module gets its own isolated cache namespace with standardized
 * key patterns for "all", "active", and "by id" lookups, plus
 * get / set / update / invalidate operations.
 *
 * Usage:
 * ```ts
 * export const tokenPackageCache = createCacheHelper({ namespace: "token_packages" });
 *
 * // get list
 * const cached = await tokenPackageCache.get<TokenPackageListResponse>(tokenPackageCache.keys.all);
 *
 * // set list
 * await tokenPackageCache.set(tokenPackageCache.keys.all, payload);
 *
 * // get/set single record
 * await tokenPackageCache.set(tokenPackageCache.keys.byId(id), tokenPackage);
 *
 * // refresh a single record in-place after update (no full invalidation)
 * await tokenPackageCache.update(id, updatedTokenPackage);
 *
 * // invalidate everything related to this record (and list/active caches)
 * await tokenPackageCache.invalidate(id);
 * ```
 */

export interface CacheHelperConfig {
  /** Unique namespace prefix for this module, e.g. "token_packages" */
  namespace: string;
  /** Default TTL in seconds. Defaults to 300 (5 minutes). */
  ttl?: number;
}

export interface CacheKeys {
  /** Cache key for the full/default list */
  all: string;
  /** Cache key for the "active"/public subset */
  active: string;
  /** Cache key for a single record by id */
  byId: (id: string) => string;
  /** Build a custom key under this namespace, e.g. keys.custom("filtered:status=active") */
  custom: (suffix: string) => string;
}

export interface CacheHelper {
  /** Standardized key builders for this namespace */
  keys: CacheKeys;
  /** Default TTL (seconds) configured for this namespace */
  ttl: number;
  /** Get and JSON-parse a cached value. Returns null on miss or error. */
  get: <T>(key: string) => Promise<T | null>;
  /** JSON-stringify and cache a value with optional custom TTL (seconds). */
  set: <T>(key: string, value: T, customTtl?: number) => Promise<void>;

  
  /**
   * Refresh a single record's cache entry in place (e.g. after an update),
   * without invalidating list/active caches. Useful when the list view
   * doesn't need to reflect the change immediately, or is invalidated separately.
   */
  update: <T>(id: string, value: T, customTtl?: number) => Promise<void>;
  /** Delete a single key from this namespace's cache. */
  del: (key: string) => Promise<void>;
  /**
   * Invalidate the "all" and "active" list caches, and optionally a
   * specific record's cache by id. Call this after create/update/delete.
   */
  invalidate: (id?: string) => Promise<void>;
  /**
   * Invalidate an arbitrary set of custom keys (built via keys.custom),
   * in addition to "all" and "active". Useful for filtered/paginated
   * list caches that don't fit the byId pattern.
   */
  invalidateKeys: (extraKeys: string[]) => Promise<void>;
}

const DEFAULT_TTL = 300; // 5 minutes

export const createCacheHelper = (config: CacheHelperConfig): CacheHelper => {
  const { namespace } = config;
  const ttl = config.ttl ?? DEFAULT_TTL;

  const keys: CacheKeys = {
    all: `${namespace}:all`,
    active: `${namespace}:active`,
    byId: (id: string) => `${namespace}:${id}`,
    custom: (suffix: string) => `${namespace}:${suffix}`,
  };

  const get = async <T>(key: string): Promise<T | null> => {
    try {
      const cached = await redisClient.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch {
      // Cache read failures should never break the request flow
      return null;
    }
  };

  const set = async <T>(key: string, value: T, customTtl?: number): Promise<void> => {
    try {
      await redisClient.setEx(key, customTtl ?? ttl, JSON.stringify(value));
    } catch {
      // Cache write failures are non-fatal — swallow silently
    }
  };

  const update = async <T>(id: string, value: T, customTtl?: number): Promise<void> => {
    await set(keys.byId(id), value, customTtl);
  };

  const del = async (key: string): Promise<void> => {
    try {
      await redisClient.del(key);
    } catch {
      // Cache delete failures are non-fatal — swallow silently
    }
  };

  const invalidate = async (id?: string): Promise<void> => {
    const targets = [keys.all, keys.active];
    if (id) targets.push(keys.byId(id));
    await Promise.all(targets.map((k) => del(k)));
  };

  const invalidateKeys = async (extraKeys: string[]): Promise<void> => {
    const targets = [keys.all, keys.active, ...extraKeys];
    await Promise.all(targets.map((k) => del(k)));
  };

  return { keys, ttl, get, set, update, del, invalidate, invalidateKeys };
};