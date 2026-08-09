import { Worker, type Job } from "bullmq";
import { BullMQQueue, JobName } from "@/shared/shared.types.enum.js";
import { bullmqConnection } from "@/redis/bullmq.connection.js";

/**
 * PROCESS_TOKEN_EXPIRY — documented placeholder, NOT real logic yet.
 *
 * `TokenTransactionType.EXPIRY` already exists as an enum value, and
 * `SubscriptionPlan.rolloverEnabled / rolloverCapPercent / rolloverExpiryCycles`
 * describe *policy*, but nothing in the current schema tracks the thing this
 * job needs to actually expire: a dated batch of unused tokens.
 *
 * `TokenWallet` (tokenWallet.model.ts) only stores running totals
 * (balance, totalPurchased, totalConsumed, totalBonus, ...) — there's no
 * per-batch ledger with its own expiry date, so there is no correct query
 * this job could run today. Guessing at that shape here would risk expiring
 * (or not expiring) the wrong tokens once the real ledger is built.
 *
 * Before enabling this job for real:
 *   1. Add a dated ledger — either fields on TokenWallet
 *      (e.g. `rolloverBalance`, `rolloverExpiresAt`) or a separate
 *      TokenBatch/TokenGrant collection with one document per grant and its
 *      own expiry date.
 *   2. Replace the body below with: find batches where `expiresAt <= now`
 *      and remaining > 0, zero them out, and write a matching
 *      TokenTransaction with type=EXPIRY for each affected wallet (in a
 *      Mongo session, same pattern as aiRequest.controller.ts).
 *   3. Add the repeatable schedule for it in repeatable.scheduler.ts.
 *
 * Until then this processor intentionally no-ops rather than mutating
 * TokenWallet based on a guessed schema.
 */
export const tokenExpiryWorker = new Worker(
  BullMQQueue.TOKEN_EXPIRY,
  async (job: Job) => {
    if (job.name !== JobName.PROCESS_TOKEN_EXPIRY) {
      throw new Error(`[tokenExpiry.worker] Unknown job name: ${job.name}`);
    }
    console.warn(
      "[tokenExpiry.worker] PROCESS_TOKEN_EXPIRY is not implemented yet — " +
        "TokenWallet has no per-batch expiry ledger. Skipping (see file comments).",
    );
  },
  {
    connection: bullmqConnection,
    concurrency: 1,
  },
);

tokenExpiryWorker.on("failed", (job, err) => {
  console.error(`[tokenExpiry.worker] ${job?.name} failed (job ${job?.id}):`, err);
});
