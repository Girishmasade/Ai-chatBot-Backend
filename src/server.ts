import { app, server } from "./socket/socket.js";
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
import dotenv from "dotenv";
dotenv.config();

const PORT = Number(process.env.PORT) || 5500;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

app.use(passport.initialize());

app.use("/api/v1", RouterFile);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    workspace: {
      root: "/",
    },
  });
});

app.use(errorHandler);

server.listen(PORT, async () => {
  console.log(`✅ Server listening on port ${PORT}`);

  try {
    startWorkers();
    await registerRepeatableJobs();
  } catch (err) {
    console.error("[BullMQ] Initialization error:", err);
  }
});

redisClient.connect().catch((err) => {
  console.error("[Redis] Connection error:", err);
});

connectDb();

try {
  configCloud();
} catch (err) {
  console.error("[Cloudinary] Config error:", err);
}

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
