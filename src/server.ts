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
import {
  registerRepeatableJobs,
  closeAllQueues,
} from "./redis/scheduler/index.js";

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

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

app.get("/", (_, res) => {
  res.send("Hello World!");
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    workspace: {
      root: "/",
    },
  });
});

// Error handler MUST be last
app.use(errorHandler);

// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

const SERVER_PORT = Number(process.env.PORT) || Number(PORT) || 5000;

async function bootstrap() {
  try {
    console.log("====================================");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("PORT:", process.env.PORT);
    console.log("SERVER_PORT:", SERVER_PORT);
    console.log("====================================");

    // Start HTTP server first
    server.listen(SERVER_PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Server running at http://0.0.0.0:${SERVER_PORT}`
      );
    });

    // Redis
    try {
      await redisClient.connect();
      console.log("✅ Redis connected");
    } catch (err) {
      console.error("❌ Redis connection failed:", err);
    }

    // MongoDB
    try {
      await connectDb();
      console.log("✅ MongoDB connected");
    } catch (err) {
      console.error("❌ MongoDB connection failed:", err);
    }

    // Cloudinary
    try {
      configCloud();
      console.log("✅ Cloudinary configured");
    } catch (err) {
      console.error("❌ Cloudinary config failed:", err);
    }

    // BullMQ
    try {
      startWorkers();
      await registerRepeatableJobs();
      console.log("✅ BullMQ initialized");
    } catch (err) {
      console.error("❌ BullMQ initialization failed:", err);
    }
  } catch (err) {
    console.error("❌ Bootstrap failed:", err);
    process.exit(1);
  }
}

bootstrap();

// -----------------------------------------------------------------------------
// Graceful Shutdown
// -----------------------------------------------------------------------------

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received. Shutting down...`);

  try {
    await shutdownWorkers();
    await closeAllQueues();

    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (err) {
    console.error("[Shutdown Error]:", err);
  }

  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
