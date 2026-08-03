import { Queue, type QueueOptions } from "bullmq";
import { BullMQQueue } from "@/shared/shared.types.enum.js";
import { bullmqConnection } from "@/redis/bullmq.connection.js";

/**
 * Default options applied to every job on every queue unless a producer
 * overrides them per-call.
 *
 * - attempts/backoff: transient failures (a DB blip, SMTP hiccup, provider
 *   timeout) get retried with exponential backoff instead of being lost.
 * - removeOnComplete/removeOnFail: BullMQ keeps finished jobs in Redis
 *   forever by default, which will silently grow memory usage in production.
 *   Bounding both by count AND age keeps recent history for debugging
 *   without unbounded growth.
 */
const defaultJobOptions: QueueOptions["defaultJobOptions"] = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
  removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
};

function createQueue(name: BullMQQueue): Queue {
  return new Queue(name, {
    connection: bullmqConnection,
    defaultJobOptions,
  });
}

// One Queue instance per BullMQQueue enum member. Import these from
// producers (controllers/services) to enqueue jobs, and from the worker
// layer only to attach QueueEvents if needed — Workers consume by queue
// *name*, not by holding a reference to the Queue instance.
export const subscriptionRenewalQueue = createQueue(BullMQQueue.SUBSCRIPTION_RENEWAL);
export const tokenExpiryQueue = createQueue(BullMQQueue.TOKEN_EXPIRY);
export const emailQueue = createQueue(BullMQQueue.EMAIL);
export const auditArchivalQueue = createQueue(BullMQQueue.AUDIT_ARCHIVAL);
export const analyticsAggregationQueue = createQueue(BullMQQueue.ANALYTICS_AGGREGATION);
export const webhookRetryQueue = createQueue(BullMQQueue.WEBHOOK_RETRY);

export const allQueues = [
  subscriptionRenewalQueue,
  tokenExpiryQueue,
  emailQueue,
  auditArchivalQueue,
  analyticsAggregationQueue,
  webhookRetryQueue,
];

/** Call on graceful shutdown (SIGTERM/SIGINT) so in-flight `queue.add()` calls flush. */
export async function closeAllQueues(): Promise<void> {
  await Promise.all(allQueues.map((q) => q.close()));
}
