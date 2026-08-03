import { Worker, type Job } from "bullmq";
import { BullMQQueue, JobName } from "@/shared/shared.types.enum.js";
import { bullmqConnection } from "@/redis/bullmq.connection.js";

/**
 * RETRY_WEBHOOK_DELIVERY — documented placeholder, NOT real logic yet.
 *
 * There is no webhook subscription/delivery module anywhere in this
 * codebase yet (no model for registered webhook URLs, no delivery-attempt
 * log). This queue exists in BullMQQueue because outbound webhooks
 * (e.g. notifying an integrator when an AIRequest completes, or a
 * subscription changes) are on the roadmap, but nothing currently produces
 * jobs for it.
 *
 * Once a webhook module exists, this job's real body is: look up the
 * failed delivery attempt, re-POST the payload with signing headers, and
 * update the delivery log's status/attempt count.
 */
export const webhookRetryWorker = new Worker(
  BullMQQueue.WEBHOOK_RETRY,
  async (job: Job) => {
    if (job.name !== JobName.RETRY_WEBHOOK_DELIVERY) {
      throw new Error(`[webhookRetry.worker] Unknown job name: ${job.name}`);
    }
    console.warn(
      "[webhookRetry.worker] RETRY_WEBHOOK_DELIVERY is not implemented yet — " +
        "no webhook module exists in this codebase. Skipping.",
    );
  },
  {
    connection: bullmqConnection,
    concurrency: 1,
  },
);

webhookRetryWorker.on("failed", (job, err) => {
  console.error(`[webhookRetry.worker] ${job?.name} failed (job ${job?.id}):`, err);
});
