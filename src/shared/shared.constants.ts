// shared/constants/token.constants.ts
import { ServiceType } from "@/shared/shared.types.enum.js";

export const SERVICE_TOKEN_COST: Record<ServiceType, number> = {
  [ServiceType.CHAT]: 5,
  [ServiceType.IMAGE]: 20,
  [ServiceType.VIDEO]: 30,
  [ServiceType.BUSINESS]: 35,
  [ServiceType.ASSETS]: 5,
};

export const SIGNUP_BONUS_TOKENS = 200;

// Combined input+output tokens covered by the base CHAT cost (5 tokens).
// Requests exceeding this incur additional 5-token blocks (handled in AIRequest module later).
export const CHAT_REQUEST_TOKEN_THRESHOLD = 8000;