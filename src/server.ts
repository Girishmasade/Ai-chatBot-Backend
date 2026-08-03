import { app, server } from "./socket/socket.js";
import { PORT } from "./env/env.import.js";
import redisClient from "./config/redis.config.js";
import { errorHandler } from "./middlewares/globslError.middleware.js";
import { connectDb } from "./config/db.config.js";
import { RouterFile } from "./routers/index.js";
import express from "express";
import passport from "./config/passport.config.js";
import session from "express-session";
import { configCloud } from "./config/cloud.config.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import { allowedCorsType } from "./config/cors.config.js";
import { startWorkers, shutdownWorkers } from "./redis/worker/index.js";
import { registerRepeatableJobs, closeAllQueues } from "./redis/scheduler/index.js";

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.use(cookieParser()); // for parsing cookies (refresh token)

const corsOptions = {
  origin: (origin: any, callback: any) => {
    if (!origin || allowedCorsType.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// FIX: session() was previously registered twice — once here with the real
// secret/cookie flags, and a second time further down with a hardcoded
// secret and no cookie options. Express applies middleware in registration
// order, so the second call was silently overwriting the first's
// `secure`/`sameSite`/`httpOnly` config on every request. Kept this one only.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
    },
  })
);

app.use(passport.initialize()); // initialize passport
// app.use(passport.session()); // initialize session

app.use("/api/v1", RouterFile)

app.get("/", (req, res) => {
    res.send("Hello World!")
})

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      "workspace": {
        "root": "/"
      }
    });
})

// FIX: errorHandler is Express error-handling middleware (arity 4:
// (err, req, res, next)). Express only routes an error into a 4-arg
// middleware that comes AFTER the route where it was thrown/passed to
// next(err). It was previously registered before `app.use("/api/v1", ...)`,
// so it could never actually catch any error your routes produced — it must
// be the LAST `app.use()` call.
app.use(errorHandler)

server.listen(PORT, async () => {
  console.log(`Server is running on port http://localhost:${PORT}`)

  // BullMQ workers start consuming as soon as their modules are imported;
  // startWorkers() is just the explicit, visible boot signal for that.
  startWorkers();
  await registerRepeatableJobs();
})

redisClient.connect()

// database config
connectDb()

// cloudinary config
configCloud();

/**
 * Graceful shutdown: stop accepting new work and let in-flight BullMQ jobs
 * finish (or return to the queue) instead of being killed mid-run, then
 * close queue connections and the HTTP server.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  try {
    await shutdownWorkers();
    await closeAllQueues();
  } catch (err) {
    console.error("[server] Error during BullMQ shutdown:", err);
  } finally {
    server.close(() => {
      console.log("[server] HTTP server closed");
      process.exit(0);
    });
  }
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
