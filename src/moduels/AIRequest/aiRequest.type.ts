
// Enums

/** Lifecycle status of a single AI request. */
export enum AIRequestStatus {
  PENDING    = "pending",
  PROCESSING = "processing",
  COMPLETED  = "completed",
  FAILED     = "failed",
  CANCELLED  = "cancelled",
}

/** Priority level — affects queue ordering & rate-limit tiers. */
export enum AIRequestPriority {
  LOW    = "low",
  NORMAL = "normal",
  HIGH   = "high",
}

