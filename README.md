# ODRL-based Authorization Prototype

This project demonstrates a complete, end-to-end workflow for ODRL-based authorization in a modern data space architecture. It uses APISIX as an API Gateway, Open Policy Agent (OPA) as a policy decision point, and a custom Node.js service as a Policy Administration Point (PAP).

The flow is as follows:
1.  A user requests a JSON Web Token (JWT) from the PAP service, providing their credentials.
2.  The user presents this JWT to the APISIX gateway to access a protected data resource.
3.  APISIX validates the JWT.
4.  The PAP service receives the request, queries OPA with the user's attributes from the JWT to get an authorization decision.
5.  If OPA allows the request, the PAP service proxies the request to the `mock-data` service, which returns the protected data.

---

## Recent Changes and Enhancements

This section outlines the significant updates and improvements made to the project:

### File and Codebase Cleanup:
*   **Duplicate Data Files Removed:** Redundant `airquality_data_kennedylaan.json`, `soundlevel_data_kennedylaan.json`, and `traffic_data_kennedylaan.json` files were removed from the root directory. The canonical versions reside in `mock-data/`.
*   **Unused Scripts Removed:** `repo_dump.txt`, `generate-jwt.js`, and `generate-jwt-invalid.js` (standalone utility scripts) have been removed to streamline the project.

### Frontend UI/UX Improvements:
*   **Architecture Diagram Relocation:** The system architecture diagram is no longer displayed on the main dashboard. It now appears dynamically within a popup modal when the "Test Protected Endpoint" button is clicked, providing contextual visualization during the simulation.
*   **Reordered Interaction Steps:** The dashboard's interactive steps have been reordered to better emphasize policy governance:
    1.  **Live Policy Editor:** Define and update ODRL policies.
    2.  **Backend Log:** Monitor real-time interactions with the backend services.
    3.  **Generate Custom JWT:** Create JSON Web Tokens with specified attributes.
    4.  **Test Protected Endpoint:** Simulate access requests to data resources.
    5.  **Final Result:** View the outcome of the access request.
*   **Scrollable Backend Log:** The "Backend Log" area is now scrollable, preventing content overflow and maintaining layout integrity when extensive log data is generated.
*   **Dark Mode Theme:** The entire interactive dashboard features a new dark mode theme for improved visual comfort and modern aesthetics.

---

## Architecture

This environment is composed of several microservices orchestrated by `docker-compose.yml`:

- **APISIX (`:9088`)**: The API Gateway and the single entry point for all traffic. It is responsible for:
  - Serving the frontend dashboard (`/`).
  - Validating JSON Web Tokens (JWTs) using the `jwt-auth` plugin.
  - Proxying requests to the appropriate backend services (`/pap/*` to the PAP, `/data/test` to the PAP).

- **PAP (Policy Administration Point)**: A custom Node.js service responsible for:
  - Generating JWTs for clients (`/auth/token`).
  - Receiving ODRL policies and translating them into OPA's Rego language (`/policies`).
  - Handling requests for protected data (`/data/test`), where it queries OPA for an authorization decision before proxying to the `mock-data` service.

- **OPA (Open Policy Agent) (`:8181`)**: The policy decision point. It runs as a standalone server and makes authorization decisions based on the Rego policies loaded by the PAP.

- **etcd**: A key-value store that holds all of APISIX's dynamic configuration (routes, consumers, etc.).

- **Mock Data**: An NGINX server that hosts various static JSON data files (e.g., `airquality_data_kennedylaan.json`, `soundlevel_data_kennedylaan.json`, `traffic_data_kennedylaan.json`), representing protected resources.

- **Frontend**: An NGINX server that hosts the `index.html` dashboard (served via APISIX).

---

## Prerequisites

- Docker
- Docker Compose

---

## Quick Start

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

## Usage and Testing

The entire system can now be tested using the interactive web dashboard. The script automatically configured APISIX to serve the dashboard.

**Access the dashboard here:** [http://192.168.2.131:9088](http://192.168.2.131:9088)
*(Note: Use your VM's IP address if you are not running this on localhost)*

### Understanding the Interactive Dashboard

The dashboard provides a guided workflow to interact with the ODRL authorization system. The steps are designed to emphasize policy governance:

1.  **Step 1: Live Policy Editor**: This section allows you to directly edit the ODRL policy that governs access to resources. Any changes made here can be pushed to the PAP service, which then translates and loads them into OPA.
2.  **Step 2: Backend Log**: Located next to the Policy Editor, this area displays real-time logs from the backend services, providing immediate feedback on policy updates, JWT generation, and access requests. It is now scrollable to accommodate extensive log data.
3.  **Step 3: Generate Custom JWT**: Here, you can generate a JSON Web Token (JWT) with specific `role` and `gemeente` attributes. This JWT will be used to authenticate and authorize requests to protected endpoints.
4.  **Step 4: Test Protected Endpoint**: Select a data resource (e.g., Air Quality Data) and use the generated JWT to attempt access. During this step, a popup will appear, visualizing the request flow through the system architecture (Client -> APISIX -> PAP -> OPA -> Mock Data).
5.  **Step 5: Final Result**: This panel displays the final response from the protected endpoint, indicating whether access was granted or denied, and returning the requested data or an error message.

The dashboard is styled with a permanent dark mode theme for a modern and comfortable user experience.

### Test 1: The "Allowed" Scenario
1.  In **Step 1: Live Policy Editor**, ensure the default policy allows `role: ICT` from `gemeente: Eindhoven` to read resources. If you've modified it, click "Update Policy".
2.  In **Step 3: Generate Custom JWT**, set the role to **"ICT"** and gemeente to **"Eindhoven"**.
3.  Click **Get JWT**.
4.  In **Step 4: Test Protected Endpoint**, select a resource (e.g., **"Air Quality Data"**).
5.  Click **Test Selected Endpoint**.
6.  **Observe the result:**
    *   **Step 2: Backend Log** will show the step-by-step authorization flow.
    *   **Step 5: Final Result** will display the protected JSON data for the selected resource.
    *   An architecture diagram popup will visualize the successful request flow.

### Test 2: The "Denied" Scenario
1.  In **Step 3: Generate Custom JWT**, set the role to **"Finance"** (or any other role not allowed by the policy) and gemeente to **"Eindhoven"**.
2.  Click **Get JWT**.
3.  In **Step 4: Test Protected Endpoint**, select any data resource.
4.  Click **Test Selected Endpoint**.
5.  **Observe the result:**
    *   **Step 2: Backend Log** will show the `pap` service denying the request.
    *   **Step 5: Final Result** will display an "Access Denied" error.
    *   An architecture diagram popup will visualize the denied request flow.

---

## Manual Testing (CLI)

You can also test the entire workflow directly from your command line using `curl`.

### 1. Get a JWT

**For a valid user (`role: "ICT"`):**
```sh
curl -s -X POST http://192.168.2.131:9088/pap/auth/token \
-H "Content-Type: application/json" \
-d '{"credentials":[{"presentedAttributes":{"role":"ICT","gemeente":"Eindhoven"}}]}'
```

This will return a JSON object with a token. Copy the token value for the next step.

### 2. Test the Protected Endpoint

Replace `[PASTE_YOUR_TOKEN_HERE]` with the token you just copied and run one of the following commands:

**Example for Air Quality data:**
```sh
TOKEN="[PASTE_YOUR_TOKEN_HERE]"
curl -i http://192.168.2.131:9088/data/airquality -H "Authorization: Bearer $TOKEN"
```

- With a **valid** token, you should receive an `HTTP/1.1 200 OK` response with the protected data in the body.
- With an **invalid** token, you should receive an `HTTP/1.1 403 Forbidden` response.


---

## Cleanup

To stop and remove all running containers and networks:

```sh
docker compose down
```