import { createClient } from "redis";
import * as dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("connect", () => {
  console.log("Redis client connecting to", redisUrl);
});

redisClient.on("ready", () => {
  console.log("Redis client is ready and connected!");
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

redisClient.on("end", () => {
  console.log("Redis client connection closed");
});

// Immediately connect to Redis
// In a modern ESM environment, we can do this asynchronously
export async function connectRedis() {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (err) {
      console.error("Failed to connect to Redis during startup:", err);
    }
  }
}
