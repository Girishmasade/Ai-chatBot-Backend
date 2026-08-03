import { Worker, type Job } from "bullmq";
import { BullMQQueue, JobName } from "@/shared/shared.types.enum.js";
import { bullmqConnection } from "@/redis/bullmq.connection.js";
import { sendEmail } from "@/services/mailer.utils.js";

/**
 * SEND_EMAIL — real, working logic.
 *
 * Thin wrapper around the existing `sendEmail()` helper in
 * services/mailer.utils.ts. Moving email out of the request/response cycle
 * and into this queue means:
 *   - an OTP/welcome/notification email being slow (or Gmail SMTP timing
 *     out) never blocks the API response that triggered it
 *   - a transient SMTP failure gets BullMQ's retry/backoff instead of
 *     silently failing once
 *
 * `job.data` is expected to be the same `EmailOptions` union `sendEmail()`
 * already takes ({ to, type, payload }) — producers should import and enqueue
 * with that exact shape rather than a new one, so this stays a pure pass-through.
 *
 * NOTE: existing call sites (auth/otp controllers, etc.) currently call
 * `sendEmail()` directly and synchronously. Rerouting them to
 * `emailQueue.add(JobName.SEND_EMAIL, options)` instead is a follow-up change
 * to those controllers, not done here, to keep this step scoped to the
 * BullMQ infrastructure itself.
 */
export const emailWorker = new Worker(
  BullMQQueue.EMAIL,
  async (job: Job) => {
    if (job.name !== JobName.SEND_EMAIL) {
      throw new Error(`[email.worker] Unknown job name: ${job.name}`);
    }
    await sendEmail(job.data);
  },
  {
    connection: bullmqConnection,
    concurrency: 10,
  },
);

emailWorker.on("completed", (job) => {
  console.log(`[email.worker] ${job.name} completed (job ${job.id})`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`[email.worker] ${job?.name} failed (job ${job?.id}):`, err);
});
