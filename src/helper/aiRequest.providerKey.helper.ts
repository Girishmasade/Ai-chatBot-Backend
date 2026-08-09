import { createCacheHelper } from "@/utils/redis.util.js";
import { decrypt } from "@/utils/encrypt.util.js";
import type { ProviderName } from "@/moduels/Provider/provider-config.types.js";
import { ProviderApiKeyModel } from "@/moduels/Provider-api-key/provider-api-key.model.js";

const PROVIDER_KEY_CACHE_NAMESPACE = "provider-api-key";
const PROVIDER_KEY_CACHE_TTL       = 15 * 60; // seconds

interface ICachedProviderKey {
  apiKey:  string;
  active:  boolean;
}

const providerKeyCache = createCacheHelper({
  namespace: PROVIDER_KEY_CACHE_NAMESPACE,
  ttl:       PROVIDER_KEY_CACHE_TTL,
});

/**
 * Returns the decrypted, currently-enabled API key for a provider.
 * Throws if the provider has no key configured or is disabled — the
 * controller's existing Step 8 loop already treats a thrown/failed attempt
 * as "try the next provider in enabledProviders", so this slots in without
 * changing that loop's control flow.
 */
export async function getDecryptedProviderKey(provider: ProviderName): Promise<string> {
  const cacheKey = providerKeyCache.keys.byId(provider);
  const cached   = await providerKeyCache.get(cacheKey) as ICachedProviderKey | null;

  if (cached) {
    if (!cached.active) {
      throw new Error(`Provider "${provider}" is disabled.`);
    }
    return cached.apiKey;
  }

  const record = await ProviderApiKeyModel.findOne({ provider }).lean();

  if (!record) {
    throw new Error(`No ProviderApiKey configured for provider: ${provider}`);
  }

  if (!record.apiKey) {
    throw new Error(`Provider "${provider}" has no API key set.`);
  }

  const decryptedKey = decrypt(record.apiKey);

  await providerKeyCache.set(cacheKey, { apiKey: decryptedKey, active: record.active });

  if (!record.active) {
    throw new Error(`Provider "${provider}" is disabled.`);
  }

  return decryptedKey;
}

/**
 * Call this from providerApiKey.controller.ts on create / update / delete / rotate,
 * so a freshly rotated or disabled key takes effect immediately instead of
 * waiting out the 15-minute TTL.
 */
export async function invalidateProviderApiKeyCache(provider: ProviderName): Promise<void> {
  await providerKeyCache.invalidate(providerKeyCache.keys.byId(provider));
}