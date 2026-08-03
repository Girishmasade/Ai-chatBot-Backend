import { AsyncHandler } from "@/utils/AsyncHandler.js";
import type { AuthUser } from "../auth/auth.payload.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { ProviderApiKeyModel } from "./provider-api-key.model.js";
import { ProviderName } from "../Provider/provider-config.types.js";
import { decrypt, encrypt, isEncrypted } from "@/utils/encrypt.util.js";
import {
  DEFAULT_ADAPTER_MAP,
  KEYLESS_PROVIDERS,
} from "./provider-api-key.types.js";
import { executeProviderRequest } from "../AIRequest/aiRequest.gateway.js";
import { PING_MODELS } from "../AIRequest/aiRequest.constant.js";

// create provider api key controller

const GATEWAY_SUPPORTED_PROVIDERS: ProviderName[] = [
  ProviderName.OPENAI,
  ProviderName.ANTHROPIC,
  ProviderName.GEMINI,
  ProviderName.GROK,
  ProviderName.DEEPSEEK,
];

export const createProviderApiKey = AsyncHandler(async (req, res, next) => {
  try {
    const adminId = (req.user as AuthUser).id;
    console.log(
      `[ProviderApiKey] createProviderApiKey called by admin: ${adminId}`,
    );

    if (!adminId) {
      return errorHandler(res, 401, false, "Unauthorized", next);
    }

    const {
      provider,
      apiKey,
      baseUrl,
      adapterType: adapterTypeInput,
      label,
      active,
      note,
    } = req.body;

    const isKeyless = KEYLESS_PROVIDERS.includes(provider as ProviderName);
    if (!isKeyless && (!apiKey || apiKey.trim() === "")) {
      return errorHandler(
        res,
        400,
        false,
        `Provider '${provider}' requires an API key`,
        next,
      );
    }

    const existing = await ProviderApiKeyModel.findOne({ provider });
    if (existing) {
      return errorHandler(
        res,
        409,
        false,
        `A key record for provider '${provider}' already exists. Use PATCH to update it.`,
        next,
      );
    }

    const resolvedAdapterType =
      adapterTypeInput ?? DEFAULT_ADAPTER_MAP[provider as ProviderName];

    if (!resolvedAdapterType) {
      return errorHandler(
        res,
        400,
        false,
        `Cannot resolve adapterType for provider '${provider}'. Please provide it explicitly.`,
        next,
      );
    }

    const encryptedKey = apiKey ? encrypt(apiKey.trim()) : null;

    const record = await ProviderApiKeyModel.create({
      provider,
      apiKey: encryptedKey,
      baseUrl: baseUrl?.trim() || null,
      adapterType: resolvedAdapterType,
      label: label.trim(),
      active: active ?? true,
      note: note?.trim() || null,
    });

    console.log(
      `[ProviderApiKey] Created key record for provider: ${provider}`,
    );

    const safeRecord = await ProviderApiKeyModel.findById(record._id);

    return successHandler(
      res,
      201,
      true,
      `API key for provider '${provider}' created successfully`,
      { record: safeRecord },
    );
  } catch (error) {
    console.log(`Something went wrong during provider api key creation`, error);
    next(error);
  }
});

// verify provider api key controller

export const verifyProviderApiKey = AsyncHandler(async(req, res, next) => {
    try {
         const adminId = (req.user as AuthUser).id;
  console.log(`[ProviderApiKey] verifyProviderApiKey called by admin: ${adminId}`);
 
  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }
 
  const provider = req.params.provider as ProviderName;
 
  // Explicitly select apiKey for verification (bypasses select: false)
  const record = await ProviderApiKeyModel.findOne({ provider }).select(
    "+apiKey",
  );
 
  if (!record) {
    return errorHandler(
      res,
      404,
      false,
      `No key record found for provider '${provider}'`,
      next,
    );
  }
 
  if (!record.active) {
    return errorHandler(
      res,
      400,
      false,
      `Provider '${provider}' key is inactive. Activate it before verifying.`,
      next,
    );
  }
 
  // Keyless providers (e.g. Pollinations) have nothing to authenticate —
  // there's no credential to ping, so report that explicitly rather than
  // attempting a request.
  if (KEYLESS_PROVIDERS.includes(provider)) {
    return successHandler(
      res,
      200,
      true,
      `Provider '${provider}' is keyless — no credential to verify.`,
      {
        provider,
        adapterType: record.adapterType,
        active: record.active,
        verified: true,
        note: "Keyless provider; nothing to authenticate.",
      },
    );
  }
 
  if (!record.apiKey) {
    return errorHandler(
      res,
      400,
      false,
      `Provider '${provider}' has no API key set. Add one before verifying.`,
      next,
    );
  }
 
  // The gateway only has real adapters for these five providers today.
  // Everything else (GROQ, HUGGINGFACE, CHATGPT) has no execute path yet,
  // so attempting to "ping" them would be misleading — be explicit instead.
  if (!GATEWAY_SUPPORTED_PROVIDERS.includes(provider)) {
    return successHandler(
      res,
      200,
      true,
      `No gateway adapter exists yet for provider '${provider}' — cannot verify connectivity.`,
      {
        provider,
        adapterType: record.adapterType,
        active: record.active,
        verified: false,
        note: "Key is stored and decryptable, but the gateway has no execute() path for this provider yet.",
      },
    );
  }
 
  let decryptedKey: string;
  try {
    decryptedKey = decrypt(record.apiKey);
  } catch (decryptErr: any) {
    console.error(
      `[ProviderApiKey] Failed to decrypt key for provider '${provider}':`,
      decryptErr,
    );
    return errorHandler(
      res,
      500,
      false,
      `Stored key for provider '${provider}' could not be decrypted. It may be corrupted — re-save it.`,
      next,
    );
  }
 
  const pingModel = PING_MODELS[provider];
 
  console.log(
    `[ProviderApiKey] Pinging provider '${provider}' with model '${pingModel}' to verify credentials...`,
  );
 
  const pingResult = await executeProviderRequest(
    provider,
    decryptedKey,
    {
      model:     pingModel,
      prompt:    "Reply with the single word: pong",
      maxTokens: 5,
    },
    "AI_CHAT",
  );
 
  if (!pingResult.success) {
    console.warn(
      `[ProviderApiKey] Verification ping failed for provider '${provider}': ${pingResult.error?.message}`,
    );
 
    return successHandler(
      res,
      200,
      true,
      `Verification ping failed for provider '${provider}'.`,
      {
        provider,
        adapterType: record.adapterType,
        active: record.active,
        verified: false,
        error: pingResult.error,
        latencyMs: pingResult.latencyMs,
      },
    );
  }
 
  console.log(
    `[ProviderApiKey] Provider '${provider}' verified successfully in ${pingResult.latencyMs}ms`,
  );
 
  return successHandler(
    res,
    200,
    true,
    `Provider '${provider}' API key verified successfully.`,
    {
      provider,
      adapterType: record.adapterType,
      active: record.active,
      verified: true,
      latencyMs: pingResult.latencyMs,
    },
  );
    } catch (error) {
        console.error("Something went wrong during provider api key verification", error);
        next(error)
    }
})

// get the all api keys

export const getAllProviderApiKeys = AsyncHandler(async (req, res, next) => {
  try {
    const adminId = (req.user as AuthUser).id;

    if (!adminId) {
      return errorHandler(res, 401, false, "Unauthorized", next);
    }

    const allKeys = await ProviderApiKeyModel.find()
      .select("-apiKey")
      .sort({ createdAt: -1 });

    const count = await ProviderApiKeyModel.countDocuments();

    return successHandler(
      res,
      200,
      true,
      "Provider API keys fetched successfully",
      { keys: allKeys, count },
    );
  } catch (error) {
    console.log(`Something went wrong during provider api key fetching`, error);
    next(error);
  }
});

// get provider api key by provider controller

export const getProviderApiKeyByProvider = AsyncHandler(
  async (req, res, next) => {
    try {
      const adminId = (req.user as AuthUser).id;
      console.log(
        `[ProviderApiKey] getProviderApiKeyByProvider called by admin: ${adminId}`,
      );

      if (!adminId) {
        return errorHandler(res, 401, false, "Unauthorized", next);
      }

      const { provider } = req.params;

      const record = await ProviderApiKeyModel.findOne({ provider });

      if (!record) {
        return errorHandler(
          res,
          404,
          false,
          `No key record found for provider '${provider}'`,
          next,
        );
      }

      return successHandler(
        res,
        200,
        true,
        "Provider API key record fetched successfully",
        { record },
      );
    } catch (error) {
      console.error(
        "Something went wrong during provider api key fetching by provider",
        error,
      );
      next(error);
    }
  },
);

// update provider api key controller

export const updateProviderApiKey = AsyncHandler(async (req, res, next) => {
  try {
    const adminId = (req.user as AuthUser).id;
    console.log(
      `[ProviderApiKey] updateProviderApiKey called by admin: ${adminId}`,
    );

    if (!adminId) {
      return errorHandler(res, 401, false, "Unauthorized", next);
    }

    const { provider } = req.params;
    const { apiKey, baseUrl, adapterType, label, active, note } = req.body;

    const record = await ProviderApiKeyModel.findOne({ provider });

    if (!record) {
      return errorHandler(
        res,
        404,
        false,
        `No key record found for provider '${provider}'`,
        next,
      );
    }

    // Build update payload — only include provided fields
  
    const updatePayload: Record<string, unknown> = {};

    if (apiKey !== undefined) {
      if (apiKey === null) {
        updatePayload.apiKey = null;
      } else {
        // Avoid double-encrypting if somehow already encrypted
        updatePayload.apiKey = isEncrypted(apiKey)
          ? apiKey
          : encrypt(apiKey.trim());
      }
    }

    if (baseUrl !== undefined) {
      updatePayload.baseUrl = baseUrl?.trim() || null;
    }

    if (adapterType !== undefined) {
      updatePayload.adapterType = adapterType;
    }

    if (label !== undefined) {
      updatePayload.label = label.trim();
    }

    if (active !== undefined) {
      updatePayload.active = active;
    }

    if (note !== undefined) {
      updatePayload.note = note?.trim() || null;
    }

    const updated = await ProviderApiKeyModel.findOneAndUpdate(
      { provider },
      { $set: updatePayload },
      { new: true, runValidators: true },
    );

    console.log(
      `[ProviderApiKey] Updated key record for provider: ${provider}`,
    );

    return successHandler(
      res,
      200,
      true,
      `API key for provider '${provider}' updated successfully`,
      { record: updated },
    );
  } catch (error) {
    console.error("Something went wrong during provider api key updating", error);
    next(error);
  }
});

// toggle provider api key controller

export const toggleProviderApiKey = AsyncHandler(async (req, res, next) => {
  try {
    const adminId = (req.user as AuthUser).id;
    console.log(
      `[ProviderApiKey] toggleProviderApiKey called by admin: ${adminId}`,
    );

    if (!adminId) {
      return errorHandler(res, 401, false, "Unauthorized", next);
    }

    const { provider } = req.params;
    const { active } = req.body;

    if (typeof active !== "boolean") {
      return errorHandler(res, 400, false, "active must be a boolean", next);
    }

    const record = await ProviderApiKeyModel.findOneAndUpdate(
      { provider },
      { $set: { active } },
      { new: true },
    );

    if (!record) {
      return errorHandler(
        res,
        404,
        false,
        `No key record found for provider '${provider}'`,
        next,
      );
    }

    console.log(
      `[ProviderApiKey] Provider '${provider}' key ${active ? "activated" : "deactivated"}`,
    );

    return successHandler(
      res,
      200,
      true,
      `Provider '${provider}' API key ${active ? "activated" : "deactivated"} successfully`,
      { record },
    );
  } catch (error) {
    console.error("Something went wrong during provider api key toggle", error);
    next(error);
  }
});

// delete provider api key controller

export const deleteProviderApiKey = AsyncHandler(async (req, res, next) => {
  try {
    const adminId = (req.user as AuthUser).id;
    console.log(
      `[ProviderApiKey] deleteProviderApiKey called by admin: ${adminId}`,
    );

    if (!adminId) {
      return errorHandler(res, 401, false, "Unauthorized", next);
    }

    const { provider } = req.params;

    const record = await ProviderApiKeyModel.findOneAndDelete({ provider });

    if (!record) {
      return errorHandler(
        res,
        404,
        false,
        `No key record found for provider '${provider}'`,
        next,
      );
    }

    console.log(
      `[ProviderApiKey] Deleted key record for provider: ${provider}`,
    );

    return successHandler(
      res,
      200,
      true,
      `API key record for provider '${provider}' deleted successfully`,
      {},
    );
  } catch (error) {
    console.error("Something went wrong during provider api key deletion", error);
    next(error);
  }
});
