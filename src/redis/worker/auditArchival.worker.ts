import { Worker, type Job } from "bullmq";
import { BullMQQueue, JobName } from "@/shared/shared.types.enum.js";
import { bullmqConnection } from "@/redis/bullmq.connection.js";

/**
 * ARCHIVE_AUDIT_LOGS — documented placeholder, NOT real logic yet.
 *
 * `AuditModule` (the enum listing which modules produce audit entries)
 * already exists in shared.types.enum.ts, but there is no AuditLog model,
 * service, or writer anywhere in this codebase yet — admin actions
 * (create/update/delete Provider, edit Subscription, revoke access, etc.)
 * aren't being logged at all right now. That module is listed as
 * "not yet started" and needs to exist before this job has anything to
 * archive.
 *
 * Once an AuditLog model exists, this job's real body is: find AuditLog
 * documents older than the retention window, move them to cold storage
 * (a `audit_logs_archive` collection, S3/Cloudinary export, etc.), then
 * delete the originals from the hot collection.
 */
export const auditArchivalWorker = new Worker(
  BullMQQueue.AUDIT_ARCHIVAL,
  async (job: Job) => {
    if (job.name !== JobName.ARCHIVE_AUDIT_LOGS) {
      throw new Error(`[auditArchival.worker] Unknown job name: ${job.name}`);
    }
    console.warn(
      "[auditArchival.worker] ARCHIVE_AUDIT_LOGS is not implemented yet — " +
        "no AuditLog model exists in this codebase. Skipping.",
    );
  },
  {
    connection: bullmqConnection,
    concurrency: 1,
  },
);

auditArchivalWorker.on("failed", (job, err) => {
  console.error(`[auditArchival.worker] ${job?.name} failed (job ${job?.id}):`, err);
});
