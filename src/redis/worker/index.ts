import type { Worker } from "bullmq";
import { subscriptionRenewalWorker } from "@/redis/worker/subscriptionRenewal.worker.js";
import { emailWorker } from "@/redis/worker/email.worker.js";
import { tokenExpiryWorker } from "@/redis/worker/tokenExpiry.worker.js";
import { auditArchivalWorker } from "@/redis/worker/auditArchival.worker.js";
import { analyticsAggregationWorker } from "@/redis/worker/analyticsAggregation.worker.js";
import { webhookRetryWorker } from "@/redis/worker/webhookRetry.worker.js";

/**
 * Importing each *.worker.ts module above already instantiates its Worker
 * (BullMQ Workers start consuming as soon as they're constructed — there is
 * no separate `.run()` call). `startWorkers()` exists as a single, explicit
 * call site in server.ts so booting the worker layer is a visible, one-line
 * decision rather than a side effect of an unrelated import.
 */
const allWorkers: Worker[] = [
  subscriptionRenewalWorker,
  emailWorker,
  tokenExpiryWorker,
  auditArchivalWorker,
  analyticsAggregationWorker,
  webhookRetryWorker,
];

export function startWorkers(): void {
  console.log(`[BullMQ] ${allWorkers.length} workers started`);
}

/** Call on SIGTERM/SIGINT so in-flight jobs finish instead of being killed mid-run. */
export async function shutdownWorkers(): Promise<void> {
  await Promise.all(allWorkers.map((w) => w.close()));
  console.log("[BullMQ] All workers shut down gracefully");
}
