import app from "./app.js";
import { connectRedis } from "./config/redis.js";
import * as dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  console.log("Starting Redis Caching Demo API...");

  // Try to connect to Redis
  try {
    await connectRedis();
  } catch (err) {
    console.error("Warning: Redis failed to connect during startup. Running without cache.", err);
  }

  // Start listening for HTTP requests
  const server = app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Server is running in ${process.env.NODE_ENV || "development"} mode`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`==================================================`);
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
      console.log("HTTP server closed.");
    });

    // Close any other open connections (like db pool, redis client) if they exist
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
