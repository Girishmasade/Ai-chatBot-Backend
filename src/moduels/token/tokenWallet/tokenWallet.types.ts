
export enum WalletStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
}

export const TOKEN_BUCKET = {
  IMAGE_GEN: "IMAGE_GEN",
  CHAT_GEN: "CHAT_GEN",
  PROMPT_GEN: "PROMPT_GEN",
  BUSINESS_IDEAS: "BUSINESS_IDEAS",
} as const;