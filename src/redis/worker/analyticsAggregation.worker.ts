import { Worker, type Job } from "bullmq";
import { BullMQQueue, JobName } from "@/shared/shared.types.enum.js";
import { bullmqConnection } from "@/redis/bullmq.connection.js";

/**
 * AGGREGATE_DAILY_ANALYTICS — documented placeholder, NOT real logic yet.
 *
 * UsageAnalytics is listed as a module that hasn't been started. Once it
 * exists, this job's real body is a daily rollup over AIRequest documents
 * (grouped by user/provider/service/day) written into UsageAnalytics, so
 * the admin dashboard can read pre-aggregated numbers instead of scanning
 * raw AIRequest at request time.
 */
export const analyticsAggregationWorker = new Worker(
  BullMQQueue.ANALYTICS_AGGREGATION,
  async (job: Job) => {
    if (job.name !== JobName.AGGREGATE_DAILY_ANALYTICS) {
      throw new Error(`[analyticsAggregation.worker] Unknown job name: ${job.name}`);
    }
    console.warn(
      "[analyticsAggregation.worker] AGGREGATE_DAILY_ANALYTICS is not implemented yet — " +
        "no UsageAnalytics model exists in this codebase. Skipping.",
    );
  },
  {
    connection: bullmqConnection,
    concurrency: 1,
  },
);

analyticsAggregationWorker.on("failed", (job, err) => {
  console.error(`[analyticsAggregation.worker] ${job?.name} failed (job ${job?.id}):`, err);
});
