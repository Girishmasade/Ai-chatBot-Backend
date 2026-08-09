// NOTE: `import IORedis from "ioredis"` type-checks as a non-constructable
// namespace under this project's module/moduleResolution ("NodeNext") +
// verbatimModuleSyntax combo, even though it works fine at runtime (ioredis
// is CJS). Using the named `Redis` export sidesteps that entirely and is
// the pattern ioredis's own docs use for ESM/NodeNext consumers.
import { Redis as IORedis, type RedisOptions } from "ioredis";
import { redisUrl } from "@/env/env.import.js";

/**
 * BullMQ needs its own ioredis connection — it cannot reuse the `redis`
 * (node-redis) client in `config/redis.config.ts`, which is used for app-level
 * caching. BullMQ's Queue/Worker/QueueEvents classes all take an ioredis
 * connection (or compatible options) via `{ connection }`.
 *
 * `maxRetriesPerRequest: null` is REQUIRED by BullMQ — the blocking commands
 * Workers issue (BRPOPLPUSH / BLMOVE under the hood) must be allowed to retry
 * indefinitely, or BullMQ throws on startup ("Your redis options maxRetries
 * per request must be null").
 *
 * A single shared connection is reused across every Queue and Worker in this
 * process rather than opening one per queue, to stay within Redis's
 * max-connections limits as more queues/workers are added.
 */
const bullmqConnectionOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const bullmqConnection = new IORedis(redisUrl, bullmqConnectionOptions);

bullmqConnection.on("connect", () => {
  console.log("[BullMQ] Redis connection established");
});

bullmqConnection.on("error", (err: Error) => {
  console.error("[BullMQ] Redis connection error:", err);
});
