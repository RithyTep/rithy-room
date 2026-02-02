#!/bin/sh

# Run database migrations
echo "Running database migrations..."
npx prisma db push --skip-generate

# Start the server
echo "Starting server..."
node dist/index.js
