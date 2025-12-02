#!/bin/bash

# A script to initialize the APISIX configuration for the ODRL demo.
# This script is idempotent, meaning it can be run multiple times without causing errors.

set -e

ADMIN_URL="http://localhost:9180/apisix/admin"
API_KEY="edd1c9f034335f136f87ad84b625c8f1"
GATEWAY_URL="http://localhost:9088"

echo "Waiting for APISIX Admin API to be ready..."
until curl -s -o /dev/null -w "%{http_code}" "$ADMIN_URL/routes" -H "X-API-KEY: $API_KEY" | grep -q 200; do
  echo -n "."
  sleep 1
done
echo -e "\nAPISIX is ready."

echo -e "\n[1/5] Creating consumer 'paradym-user'..."
curl -s "$ADMIN_URL/consumers/paradym-user" -H "X-API-KEY: $API_KEY" -X PUT -d '
{
  "username": "paradym-user",
  "plugins": {
    "jwt-auth": {
      "key": "paradym-user",
      "secret": "a-secure-key-for-testing"
    }
  }
}'

echo -e "\n[2/5] Creating 'mock-data-service' upstream..."
curl -s "$ADMIN_URL/upstreams/mock-data-upstream" -H "X-API-KEY: $API_KEY" -X PUT -d '
{
  "name": "mock-data-service",
  "nodes": {
    "mock-data:80": 1
  }
}'

echo -e "\n[3/5] Creating 'pap-service' upstream..."
curl -s "$ADMIN_URL/upstreams/pap-service-upstream" -H "X-API-KEY: $API_KEY" -X PUT -d '
{
  "name": "pap-service-upstream",
  "nodes": {
    "pap:3000": 1
  }
}'

echo -e "\n[4/5] Creating routes..."
# Route for the protected data endpoint
curl -s "$ADMIN_URL/routes/data-route" -H "X-API-KEY: $API_KEY" -X PUT -d '
{
    "name": "data-route",
    "uri": "/data/test",
    "methods": ["GET", "OPTIONS"],
    "upstream_id": "pap-service-upstream",
    "plugins": {
        "jwt-auth": {
            "key_claim_name": "key"
        },
        "cors": {}
    }
}'

# Route for the PAP service (JWT generation and policy upload)
curl -s "$ADMIN_URL/routes/pap-route" -H "X-API-KEY: $API_KEY" -X PUT -d '
{
    "name": "pap-route",
    "uris": ["/pap/*"],
    "methods": ["GET", "POST", "OPTIONS"],
    "upstream_id": "pap-service-upstream",
    "plugins": {
        "cors": {},
        "proxy-rewrite": {
            "regex_uri": ["^/pap/(.*)", "/$1"]
        }
    }
}'

# Allow the frontend to be served through the gateway as well to avoid all CORS issues
# First, create an upstream for it
curl -s "$ADMIN_URL/upstreams/frontend-upstream" -H "X-API-KEY: $API_KEY" -X PUT -d '
{
  "name": "frontend-service",
  "nodes": {
    "frontend:80": 1
  }
}'
# Then, create a route for it
curl -s "$ADMIN_URL/routes/frontend-route" -H "X-API-KEY: $API_KEY" -X PUT -d '
{
    "name": "frontend-route",
    "uri": "/*",
    "priority": -10,
    "upstream_id": "frontend-upstream"
}'


echo -e "\n[5/5] Pushing ODRL policy to OPA via PAP service..."
# It might take a moment for the routes to become active
sleep 2 
curl -s "$GATEWAY_URL/pap/policies" -H "Content-Type: application/json" -d '@policies/eindhoven-ict.json'

echo -e "\n\nInitialization complete!"
echo "You can now access the dashboard at http://localhost:9088 (via APISIX)"
