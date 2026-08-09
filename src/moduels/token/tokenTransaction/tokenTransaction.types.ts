/**
 * PURCHASE      — user buys a token package via payment
 * CONSUMPTION   — AI request deducts tokens
 * REFUND        — reverses a PURCHASE (full or partial)
 * REVERSAL      — undoes a CONSUMPTION (e.g. AI call failed after deduction)
 * BONUS         — admin gifts free tokens
 * ADJUSTMENT    — admin manually corrects a balance discrepancy (audit-heavy)
 * PLAN_CREDIT   — tokens granted automatically on subscription assignment
 * EXPIRY        — tokens removed when a plan/time window expires (future use)
 */

export enum TransactionType {
  PURCHASE    = 'PURCHASE',
  CONSUMPTION = 'CONSUMPTION',
  REFUND      = 'REFUND',
  REVERSAL    = 'REVERSAL',
  BONUS       = 'BONUS',
  ADJUSTMENT  = 'ADJUSTMENT',
  PLAN_CREDIT = 'PLAN_CREDIT',
  EXPIRY      = 'EXPIRY',
}
 
/** Who or what initiated the transaction. */

export enum TransactionSource {
  USER       = 'USER',
  AI_REQUEST = 'AI_REQUEST',
  ADMIN      = 'ADMIN',
  SYSTEM     = 'SYSTEM',
}
 
/**
 * PENDING   → COMPLETED | FAILED   (settlement lifecycle)
 * REVERSED  (only set via the reverse-transaction flow, never deleted, never re-used)
 */

export enum TransactionStatus {
  PENDING   = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED    = 'FAILED',
  REVERSED  = 'REVERSED',
}
 
// Credit / Debit classification — single source of truth for direction logic
 
export const CREDIT_TYPES = new Set<TransactionType>([
  TransactionType.PURCHASE,
  TransactionType.REFUND,
  TransactionType.REVERSAL,
  TransactionType.BONUS,
  TransactionType.PLAN_CREDIT,
]);
 
export const DEBIT_TYPES = new Set<TransactionType>([
  TransactionType.CONSUMPTION,
  TransactionType.EXPIRY,
]);
// ADJUSTMENT is intentionally excluded — its direction is determined by the
// sign of `amount` at the point of creation, not by its type.
 