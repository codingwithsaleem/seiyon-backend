# Use Node.js 22 LTS as base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (needed for build)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Set placeholder DATABASE_URL for Prisma generate during build
# The real DATABASE_URL will be provided at runtime via .env file
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"

# Build the TypeScript application with increased memory
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 6001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:6001/health || exit 1

# Start the application with Prisma migrations
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm start"]
