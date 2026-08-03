import { JobName } from "@/shared/shared.types.enum.js";
import { subscriptionRenewalQueue } from "@/redis/scheduler/queue.registry.js";

/**
 * Registers all cron-style repeatable jobs. Safe to call on every server
 * boot: BullMQ keys a repeatable job by { queue, jobName, pattern/every,
 * jobId }, so calling `.add()` again with identical arguments is a no-op
 * against an already-registered schedule rather than creating a duplicate.
 *
 * Only jobs with a real, schema-backed implementation are scheduled here.
 * See worker/*.worker.ts for which queues have working processors vs.
 * documented placeholders — scheduling a job whose processor is a no-op
 * would just waste a tick every run for no benefit.
 */
export async function registerRepeatableJobs(): Promise<void> {
  // Runs hourly: sweeps UserSubscription documents where status=ACTIVE and
  // endDate has passed, and flips them to EXPIRED. See
  // subscriptionRenewal.worker.ts for the query/update logic.
  await subscriptionRenewalQueue.add(
    JobName.PROCESS_SUBSCRIPTION_EXPIRY,
    {},
    {
      repeat: { pattern: "0 * * * *" }, // top of every hour
      jobId: JobName.PROCESS_SUBSCRIPTION_EXPIRY, // stable id -> prevents duplicate schedules
    },
  );

  // NOTE: PROCESS_SUBSCRIPTION_RENEWAL (actually re-charging a user and
  // starting a new billing cycle) is intentionally NOT scheduled yet — it
  // depends on the Payment module, which is currently an empty folder
  // (moduels/payment/). Wire this up once Payment exists; the queue and
  // worker plumbing are already in place to receive it.

  // NOTE: TOKEN_EXPIRY, AUDIT_ARCHIVAL, ANALYTICS_AGGREGATION, and
  // WEBHOOK_RETRY are intentionally NOT scheduled here yet. Their queues and
  // Worker processors exist (see redis/worker/), but the processors are
  // documented placeholders because the data models they need don't exist
  // yet in this codebase:
  //   - TOKEN_EXPIRY needs a per-batch rollover ledger on TokenWallet
  //     (e.g. rolloverBalance / rolloverExpiresAt) — TokenWallet currently
  //     only stores running totals, not dated batches, so there is nothing
  //     correct to expire yet.
  //   - AUDIT_ARCHIVAL needs an AuditLog model (not started).
  //   - ANALYTICS_AGGREGATION needs a UsageAnalytics model (not started).
  //   - WEBHOOK_RETRY needs a webhook subscription/delivery model (not started).
  // Add their `.add(..., { repeat: {...} })` calls here once those modules
  // land — the queue + worker infrastructure will pick them up with no
  // further plumbing changes.
}
