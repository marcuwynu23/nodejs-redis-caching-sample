# ==========================================
# Stage 1: Build Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and build
COPY src/ ./src/
RUN npm run build

# ==========================================
# Stage 2: Production Stage
# ==========================================
FROM node:22-alpine

WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production

# Copy package files and install production-only dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled code and configuration
COPY --from=builder /usr/src/app/dist ./dist
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.js"]
