import { Worker, type Job } from "bullmq";
import { BullMQQueue, JobName, UserSubscriptionStatus } from "@/shared/shared.types.enum.js";
import { bullmqConnection } from "@/redis/bullmq.connection.js";
import { UserSubscriptionModel } from "@/moduels/subscription/userSubscription.model.js";

/**
 * PROCESS_SUBSCRIPTION_EXPIRY — real, working logic.
 *
 * Finds every UserSubscription that is still marked ACTIVE but whose
 * `endDate` has already passed, and flips it to EXPIRED in a single bulk
 * update. This uses the `{ status: 1, endDate: 1 }` index already defined
 * on the model specifically for this query.
 *
 * Deliberately a bulk `updateMany`, not a per-document loop + `.save()`:
 * at scale this can be thousands of rows an hour, and we don't need
 * per-document hooks here — just a status flip.
 */
async function processSubscriptionExpiry(): Promise<{ expiredCount: number }> {
  const now = new Date();

  const result = await UserSubscriptionModel.updateMany(
    {
      status: UserSubscriptionStatus.ACTIVE,
      endDate: { $ne: null, $lte: now },
    },
    {
      $set: { status: UserSubscriptionStatus.EXPIRED },
    },
  );

  return { expiredCount: result.modifiedCount };
}

/**
 * PROCESS_SUBSCRIPTION_RENEWAL — placeholder.
 *
 * Real auto-renewal means: charge the user's saved payment method for the
 * next cycle, and on success create a new UserSubscription (or extend
 * endDate) + grant tokens via TokenTransaction (SUBSCRIPTION_GRANT). All of
 * that depends on the Payment module, which is currently an empty folder
 * (moduels/payment/). This job is intentionally not scheduled anywhere yet
 * (see repeatable.scheduler.ts) — this processor exists so the queue
 * doesn't error if a job is ever manually enqueued against it, and so the
 * real implementation has an obvious place to go once Payment exists.
 */
async function processSubscriptionRenewal(job: Job): Promise<void> {
  console.warn(
    `[subscriptionRenewal.worker] PROCESS_SUBSCRIPTION_RENEWAL received (job ${job.id}) ` +
      "but is not implemented — Payment module does not exist yet. Skipping.",
  );
}

export const subscriptionRenewalWorker = new Worker(
  BullMQQueue.SUBSCRIPTION_RENEWAL,
  async (job: Job) => {
    switch (job.name) {
      case JobName.PROCESS_SUBSCRIPTION_EXPIRY:
        return processSubscriptionExpiry();
      case JobName.PROCESS_SUBSCRIPTION_RENEWAL:
        return processSubscriptionRenewal(job);
      default:
        throw new Error(`[subscriptionRenewal.worker] Unknown job name: ${job.name}`);
    }
  },
  {
    connection: bullmqConnection,
    concurrency: 5,
  },
);

subscriptionRenewalWorker.on("completed", (job, result) => {
  console.log(`[subscriptionRenewal.worker] ${job.name} completed`, result);
});

subscriptionRenewalWorker.on("failed", (job, err) => {
  console.error(`[subscriptionRenewal.worker] ${job?.name} failed:`, err);
});
