#!/bin/bash

# Configuration
APP_NAME="doris-analysis"

# Validate Environment Variables
if [ -z "$DORIS_HOST" ]; then
    echo "Error: DORIS_HOST environment variable is not set."
    exit 1
fi

if [ -z "$DORIS_USER" ]; then
    echo "Error: DORIS_USER environment variable is not set."
    exit 1
fi

if [ -z "$DORIS_PASSWORD" ]; then
    echo "Error: DORIS_PASSWORD environment variable is not set."
    exit 1
fi

# Default port to 9030 if not set
DORIS_PORT=${DORIS_PORT:-9030}

echo "Starting deployment for $APP_NAME..."
echo "Database: $DORIS_HOST:$DORIS_PORT ($DORIS_USER)"

# 1. Stop and remove existing container
if [ "$(docker ps -q -f name=$APP_NAME)" ]; then
    echo "Stopping existing container..."
    docker stop $APP_NAME
fi

if [ "$(docker ps -aq -f name=$APP_NAME)" ]; then
    echo "Removing existing container..."
    docker rm $APP_NAME
fi

# 2. Rebuild image
echo "Building Docker image..."
docker build -t $APP_NAME .

# 3. Run new container
echo "Starting new container..."
docker run -d \
  -p 3000:3000 \
  --name $APP_NAME \
  -e DORIS_HOST="$DORIS_HOST" \
  -e DORIS_PORT="$DORIS_PORT" \
  -e DORIS_USER="$DORIS_USER" \
  -e DORIS_PASSWORD="$DORIS_PASSWORD" \
  $APP_NAME

echo "Deployment complete! App is running on port 3000."
