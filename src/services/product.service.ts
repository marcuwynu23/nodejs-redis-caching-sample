import { db } from "../config/db.js";
import { redisClient } from "../config/redis.js";
import { products, type Product } from "../db/schema.js";
import { eq } from "drizzle-orm";

const CACHE_TTL = 60; // 60 seconds
const CACHE_KEY_ALL = "products:all";
const getCacheKeySingle = (id: number) => `product:${id}`;

// Graceful Cache Helpers to ensure high availability if Redis goes down
async function getCache(key: string): Promise<string | null> {
  if (!redisClient.isOpen) {
    console.warn(`[Cache Warning] Redis is not open. Skipping GET for key: ${key}`);
    return null;
  }
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error(`[Cache Error] Failed to GET key "${key}":`, error);
    return null;
  }
}

async function setCache(key: string, value: string, ttl: number = CACHE_TTL): Promise<void> {
  if (!redisClient.isOpen) {
    console.warn(`[Cache Warning] Redis is not open. Skipping SET for key: ${key}`);
    return;
  }
  try {
    await redisClient.set(key, value, { EX: ttl });
  } catch (error) {
    console.error(`[Cache Error] Failed to SET key "${key}":`, error);
  }
}

async function delCache(key: string): Promise<void> {
  if (!redisClient.isOpen) {
    console.warn(`[Cache Warning] Redis is not open. Skipping DEL for key: ${key}`);
    return;
  }
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error(`[Cache Error] Failed to DEL key "${key}":`, error);
  }
}

export interface ServiceResponse<T> {
  data: T;
  source: "cache" | "database";
}

export class ProductService {
  /**
   * Get all products using the Cache-Aside pattern.
   */
  static async getAllProducts(): Promise<ServiceResponse<Product[]>> {
    // 1. Try to fetch from Redis cache
    const cachedData = await getCache(CACHE_KEY_ALL);
    if (cachedData) {
      return {
        data: JSON.parse(cachedData),
        source: "cache",
      };
    }

    // 2. Cache miss: Query the PostgreSQL database
    const dbProducts = await db.select().from(products);

    // 3. Store the result in Redis with a 60-second TTL
    await setCache(CACHE_KEY_ALL, JSON.stringify(dbProducts), CACHE_TTL);

    return {
      data: dbProducts,
      source: "database",
    };
  }

  /**
   * Get a product by ID using the Cache-Aside pattern.
   */
  static async getProductById(id: number): Promise<ServiceResponse<Product | null>> {
    const cacheKey = getCacheKeySingle(id);

    // 1. Try to fetch from Redis cache
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return {
        data: JSON.parse(cachedData),
        source: "cache",
      };
    }

    // 2. Cache miss: Query the PostgreSQL database
    const dbResult = await db.select().from(products).where(eq(products.id, id)).limit(1);
    const product = dbResult[0] || null;

    // 3. Store in Redis if the product exists (no need to cache null/404s, or we can cache short-lived nulls if needed)
    if (product) {
      await setCache(cacheKey, JSON.stringify(product), CACHE_TTL);
    }

    return {
      data: product,
      source: "database",
    };
  }

  /**
   * Create a product and invalidate stale cache.
   */
  static async createProduct(name: string, price: number): Promise<Product> {
    // 1. Insert product into database
    const [newProduct] = await db
      .insert(products)
      .values({ name, price })
      .returning();

    // 2. Invalidate cache: Delete products:all since the list has changed
    await delCache(CACHE_KEY_ALL);

    return newProduct;
  }

  /**
   * Update a product, invalidating both individual and list caches.
   */
  static async updateProduct(id: number, name: string, price: number): Promise<Product | null> {
    // 1. Update product in database
    const [updatedProduct] = await db
      .update(products)
      .set({ name, price })
      .where(eq(products.id, id))
      .returning();

    if (!updatedProduct) {
      return null;
    }

    // 2. Invalidate cache: Delete both individual and list caches
    await delCache(getCacheKeySingle(id));
    await delCache(CACHE_KEY_ALL);

    return updatedProduct;
  }

  /**
   * Delete a product, invalidating both individual and list caches.
   */
  static async deleteProduct(id: number): Promise<boolean> {
    // 1. Delete product from database
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    
    if (result.length === 0) {
      return false; // Product did not exist
    }

    // 2. Invalidate cache: Delete both individual and list caches
    await delCache(getCacheKeySingle(id));
    await delCache(CACHE_KEY_ALL);

    return true;
  }
}
