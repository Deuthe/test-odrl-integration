#!/bin/sh
echo "Waiting for mock-data to be ready..."
until nc -z mock-data 80; do
  sleep 1
done
echo "mock-data ready — starting APISIX"
exec /docker-entrypoint.sh apisix start
