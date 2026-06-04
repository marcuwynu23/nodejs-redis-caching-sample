import { Request, Response } from "express";
import { ProductService } from "../services/product.service.js";

export class ProductController {
  static async getAllProducts(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    try {
      const { data, source } = await ProductService.getAllProducts();
      const durationMs = performance.now() - startTime;

      // Set custom response headers to indicate cache status
      res.setHeader("X-Cache-Status", source.toUpperCase());
      res.setHeader("X-Response-Time", `${durationMs.toFixed(2)}ms`);

      res.status(200).json({
        success: true,
        meta: {
          source,
          durationMs: parseFloat(durationMs.toFixed(2)),
          count: data.length,
          message: source === "cache" 
            ? "Successfully retrieved all products from Redis cache." 
            : "Successfully retrieved all products from PostgreSQL database.",
        },
        data,
      });
    } catch (error) {
      console.error("Error in getAllProducts controller:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  static async getProductById(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "Invalid product ID. Must be an integer.",
        });
        return;
      }

      const { data, source } = await ProductService.getProductById(id);
      const durationMs = performance.now() - startTime;

      if (!data) {
        res.status(404).json({
          success: false,
          meta: {
            source: "database",
            durationMs: parseFloat(durationMs.toFixed(2)),
            message: "Product not found.",
          },
          error: `Product with ID ${id} not found`,
        });
        return;
      }

      res.setHeader("X-Cache-Status", source.toUpperCase());
      res.setHeader("X-Response-Time", `${durationMs.toFixed(2)}ms`);

      res.status(200).json({
        success: true,
        meta: {
          source,
          durationMs: parseFloat(durationMs.toFixed(2)),
          message: source === "cache"
            ? `Successfully retrieved product ${id} from Redis cache.`
            : `Successfully retrieved product ${id} from PostgreSQL database.`,
        },
        data,
      });
    } catch (error) {
      console.error(`Error in getProductById controller for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  static async createProduct(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    try {
      const { name, price } = req.body;

      if (!name || typeof name !== "string" || name.trim() === "") {
        res.status(400).json({
          success: false,
          error: "Product name is required and must be a non-empty string.",
        });
        return;
      }

      if (price === undefined || typeof price !== "number" || price < 0) {
        res.status(400).json({
          success: false,
          error: "Product price is required and must be a non-negative number (in cents/integers).",
        });
        return;
      }

      const newProduct = await ProductService.createProduct(name.trim(), price);
      const durationMs = performance.now() - startTime;

      res.status(201).json({
        success: true,
        meta: {
          source: "database",
          durationMs: parseFloat(durationMs.toFixed(2)),
          message: "Product created successfully. Redis products cache invalidated.",
        },
        data: newProduct,
      });
    } catch (error) {
      console.error("Error in createProduct controller:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  static async updateProduct(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "Invalid product ID. Must be an integer.",
        });
        return;
      }

      const { name, price } = req.body;

      if (!name || typeof name !== "string" || name.trim() === "") {
        res.status(400).json({
          success: false,
          error: "Product name is required and must be a non-empty string.",
        });
        return;
      }

      if (price === undefined || typeof price !== "number" || price < 0) {
        res.status(400).json({
          success: false,
          error: "Product price is required and must be a non-negative number (in cents/integers).",
        });
        return;
      }

      const updatedProduct = await ProductService.updateProduct(id, name.trim(), price);
      const durationMs = performance.now() - startTime;

      if (!updatedProduct) {
        res.status(404).json({
          success: false,
          error: `Product with ID ${id} not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        meta: {
          source: "database",
          durationMs: parseFloat(durationMs.toFixed(2)),
          message: `Product ${id} updated successfully. Redis cache cleared.`,
        },
        data: updatedProduct,
      });
    } catch (error) {
      console.error(`Error in updateProduct controller for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  static async deleteProduct(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "Invalid product ID. Must be an integer.",
        });
        return;
      }

      const deleted = await ProductService.deleteProduct(id);
      const durationMs = performance.now() - startTime;

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: `Product with ID ${id} not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        meta: {
          source: "database",
          durationMs: parseFloat(durationMs.toFixed(2)),
          message: `Product ${id} deleted successfully. Redis cache cleared.`,
        },
      });
    } catch (error) {
      console.error(`Error in deleteProduct controller for ID ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}
