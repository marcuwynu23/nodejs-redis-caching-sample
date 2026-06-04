import express, { type Request, type Response, type NextFunction } from "express";
import productRoutes from "./routes/product.routes.js";
import { redisClient } from "./config/redis.js";
import { pool } from "./config/db.js";

const app = express();

// Standard middleware
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  const start = performance.now();
  res.on("finish", () => {
    const duration = performance.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration.toFixed(2)}ms)`);
  });
  next();
});

// Root route displaying API information and environment health
app.get("/", async (req: Request, res: Response) => {
  let dbStatus = "disconnected";
  let redisStatus = "disconnected";

  try {
    if (pool) {
      await pool.query("SELECT 1");
      dbStatus = "connected";
    }
  } catch (err) {
    dbStatus = `error: ${(err as Error).message}`;
  }

  try {
    if (redisClient.isOpen) {
      redisStatus = "connected";
    }
  } catch (err) {
    redisStatus = `error: ${(err as Error).message}`;
  }

  res.status(200).json({
    name: "Redis Caching Demo API",
    description: "TypeScript Express API demonstrating Redis cache-aside caching with PostgreSQL",
    version: "1.0.0",
    status: {
      api: "healthy",
      database: dbStatus,
      redis: redisStatus,
    },
    documentation: {
      endpoints: [
        { method: "GET", path: "/products", description: "Retrieve all products (Cached, 60s TTL)" },
        { method: "GET", path: "/products/:id", description: "Retrieve a specific product by ID (Cached, 60s TTL)" },
        { method: "POST", path: "/products", description: "Create a product (Invalidates list cache)" },
        { method: "PUT", path: "/products/:id", description: "Update a product (Invalidates both specific & list cache)" },
        { method: "DELETE", path: "/products/:id", description: "Delete a product (Invalidates both specific & list cache)" },
        { method: "GET", path: "/health", description: "Simple health status endpoint" },
      ]
    }
  });
});

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// Mount Product Routes
app.use("/products", productRoutes);

// 404 Route handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled exception occurred:", err);
  res.status(500).json({
    success: false,
    error: "An unexpected error occurred on the server.",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export default app;
