#!/bin/bash

echo "Building Docker images for Mock API AI..."

echo
echo "Building mock-api image..."
docker build -f Dockerfile.mockapi -t mock-api-ai:latest .

echo
echo "Building LLM service image..."
docker build -f Dockerfile.llm -t mock-api-ai-llm:latest .

echo
echo "Build completed!"
echo
echo "To start the services, run:"
echo "docker-compose up -d"
echo
echo "To view logs:"
echo "docker-compose logs -f" 