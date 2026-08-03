import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { emitToAll } from "../socket/socket.emitter.js";

// socket io transport for logs
class SocketIOTransport extends winston.Transport {
  constructor(opts?: winston.transport.TransportStreamOptions) {
    super(opts);
  }

  log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    try {
      // push log to admin client
      emitToAll("admin:log_stream" as any, {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action: info.message || "Log Event",
        operator: "System",
        timestamp: new Date().toLocaleString(),
        details: JSON.stringify(info),
        level: info.level,
      });
    } catch (error) {
      // ignore
    }

    callback();
  }
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new DailyRotateFile({
      filename: "logs/application-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
    new SocketIOTransport(),
  ],
});
