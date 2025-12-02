# ODRL-based Authorization Prototype

This project demonstrates a complete, end-to-end workflow for ODRL-based authorization in a modern data space architecture. It uses APISIX as an API Gateway, Open Policy Agent (OPA) as a policy decision point, and a custom Node.js service as a Policy Administration Point (PAP).

The flow is as follows:
1.  A user requests a JSON Web Token (JWT) from the PAP service, providing their credentials.
2.  The user presents this JWT to the APISIX gateway to access a protected data resource.
3.  APISIX validates the JWT.
4.  The PAP service receives the request, queries OPA with the user's attributes from the JWT to get an authorization decision.
5.  If OPA allows the request, the PAP service proxies the request to the `mock-data` service, which returns the protected data.

---

## Prerequisites

- Docker
- Docker Compose

---

## 🚀 Quick Start

Getting the environment running is a simple two-step process.

### 1. Start the Services

Build and start all the services in the background:

```sh
docker compose up -d --build
```

### 2. Initialize the Configuration

After the services have started, run the initialization script. This will automatically configure APISIX (routes, consumers, upstreams) and push the initial policy to OPA.

```sh
./init-apisix.sh
```

Wait for the script to complete. You should see "Initialization complete!" at the end.

---

## 🧪 Usage and Testing

The entire system can now be tested using the interactive web dashboard. The script automatically configured APISIX to serve the dashboard.

**Access the dashboard here:** [http://localhost:9088](http://localhost:9088)

### Test 1: The "Allowed" Scenario
1.  Make sure the dropdown is set to **"Valid User (role: ICT, gemeente: Eindhoven)"**.
2.  Click **Get JWT**.
3.  Click **Test /data/test**.
4.  **Observe the result:** The "Backend Log" will show the step-by-step flow, and the "Final Result" will show the protected JSON data.

### Test 2: The "Denied" Scenario
1.  Change the dropdown to **"Invalid User (role: Finance, gemeente: Eindhoven)"**.
2.  Click **Get JWT**.
3.  Click **Test /data/test**.
4.  **Observe the result:** The "Backend Log" will show OPA returning a `DENY` decision, and the "Final Result" will show an "Access Denied" error.

---

## 🧹 Cleanup

To stop and remove all running containers and networks:

```sh
docker compose down
```