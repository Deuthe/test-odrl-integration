const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();

// --- Log Polling Logic ---

// In-memory array to store log messages
let logs = [];

// Function to add a message to the logs array
function broadcast(message, statusClass) {
  const payload = { message, statusClass, timestamp: new Date().toISOString() };
  logs.push(payload);
  // Also log to the console for server-side debugging
  console.log(`[LOG] ${message}`);
}

// --- Express App Logic ---

app.use(express.json());

// Add a robust CORS middleware to handle preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    return res.status(200).json({});
  }
  
  next();
});

const JWT_SECRET = 'a-secure-key-for-testing';

// --- Endpoints ---

// New endpoint for the dashboard to poll for logs
app.get('/logs', (req, res) => {
  res.json(logs);
  logs = []; // Clear logs after they have been sent
});

// 1. Policy Upload Endpoint
app.post('/policies', async (req, res) => {
  broadcast('Received request to update policy...', 'status-send');
  const odrl = req.body;
  let constraints = '';
  if (odrl.permission) {
    odrl.permission.forEach(p => {
      if (p.constraint) {
        p.constraint.forEach(c => {
          constraints += `    input.attributes["${c.leftOperand}"] == "${c.rightOperand}"
`;
        });
      }
    });
  }

  const rego = [
    'package httpauthz', '', 'default decision = false', '', 'decision = true {',
    constraints.trim(), '    input.method == "GET"',
    '    startswith(input.path, "/data/")', 
    '}'
  ].join('\n');
  
  broadcast('Generated new Rego policy. Pushing to OPA...', 'status-info');

  try {
    await axios.put('http://opa:8181/v1/policies/eindhoven', rego, { headers: { 'Content-Type': 'text/plain' } });
    broadcast('Policy updated successfully in OPA.', 'status-success');
    res.json({ success: true, status: "Policy Active" });
  } catch (e) {
    broadcast(`Error updating policy in OPA: ${e.message}`, 'status-fail');
    res.status(500).json({ error: "Failed to update policy engine" });
  }
});

// 2. JWT Issuance Endpoint
app.post('/auth/token', (req, res) => {
  broadcast('Received request to generate JWT...', 'status-send');
  try {
    const attributes = req.body?.credentials?.[0]?.presentedAttributes;
    if (!attributes || !attributes.role || !attributes.gemeente) {
      broadcast('Invalid wallet data in JWT request.', 'status-fail');
      return res.status(400).json({ error: "Invalid wallet data: missing role or gemeente attributes" });
    }
    const payload = {
      role: attributes.role,
      gemeente: attributes.gemeente,
      key: 'paradym-user'
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    broadcast('JWT generated successfully.', 'status-success');
    res.json({ token });
  } catch (error) {
    broadcast(`Error generating JWT: ${error.message}`, 'status-fail');
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// 3. Dynamic Data Access Endpoint
const resourceNameToFile = {
  'airquality': 'airquality_data_kennedylaan.json',
  'soundlevel': 'soundlevel_data_kennedylaan.json',
  'traffic': 'traffic_data_kennedylaan.json'
};

app.get('/data/:resourceName', async (req, res) => {
    broadcast(`Received request for protected data: ${req.path}`, 'status-send');
    const { resourceName } = req.params;
    const fileName = resourceNameToFile[resourceName];

    if (!fileName) {
      broadcast(`Requested resource "${resourceName}" does not exist.`, 'status-fail');
      return res.status(404).json({ error: "The requested data resource does not exist." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        broadcast('Authorization header missing or invalid.', 'status-fail');
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
        broadcast('JWT is valid.', 'status-success');
    } catch (err) {
        broadcast('Invalid JWT provided.', 'status-fail');
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const input = {
        method: "GET",
        path: req.path,
        attributes: {
            role: decoded.role,
            gemeente: decoded.gemeente
        }
    };

  try {
    broadcast(`Querying OPA for decision with attributes: role=${decoded.role}, gemeente=${decoded.gemeente}`, 'status-eval');
    const opaResp = await axios.post('http://opa:8181/v1/data/httpauthz/decision', { input });
    
    if (opaResp.data.result === true) {
      broadcast('OPA decision: ALLOW', 'status-success');
      broadcast(`Proxying request to mock-data service for file: ${fileName}`, 'status-info');
      const mockResp = await axios.get(`http://mock-data/${fileName}`);
      res.json(mockResp.data);
    } else {
      broadcast('OPA decision: DENY', 'status-fail');
      res.status(403).json({
        error: "Access Denied", 
        reason: "ODRL Policy constraints not met." 
      });
    }
  } catch (e) {
    broadcast(`Internal error during OPA query or proxying: ${e.message}`, 'status-fail');
    res.status(500).json({ error: "Internal System Error" });
  }
});

// Use the standard Express app to listen
app.listen(3000, () => console.log('PAP Service (with Log Polling) running on port 3000'));
