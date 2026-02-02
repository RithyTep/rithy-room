FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY turbo.json ./

# Copy packages
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Install all dependencies
RUN npm install

# Build shared first
RUN npm run build --workspace=@rithy-room/shared

# Build server
RUN npm run build --workspace=@rithy-room/server

# Generate Prisma client and setup
WORKDIR /app/apps/server
RUN npx prisma generate
RUN mkdir -p uploads

ENV PORT=3001
EXPOSE 3001

# Start from the server directory
CMD ["node", "dist/index.js"]
