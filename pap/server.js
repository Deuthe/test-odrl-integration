const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());

// Add a more robust CORS middleware to handle preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    return res.status(200).json({});
  }
  
  next();
});

const JWT_SECRET = 'a-secure-key-for-testing';

// 1. Policy Upload Endpoint (Unchanged)
app.post('/policies', async (req, res) => {
  const odrl = req.body;
  let constraints = '';
  // Extract constraints from ODRL JSON
  if (odrl.permission) {
    odrl.permission.forEach(p => {
      if (p.constraint) {
        p.constraint.forEach(c => {
          constraints += `    input.attributes["${c.leftOperand}"] == "${c.rightOperand}"\n`;
        });
      }
    });
  }

  // Build Rego Policy
  const rego = [
    'package httpauthz',
    '',
    'default decision = false', // Changed: use 'decision'
    '',
    'decision = true {', // Changed: use 'decision'
    constraints.trim(),
    '    input.method == "GET"',
    '    startswith(input.path, "/data/")',
    '}'
  ].join('\n');

  try {
    // Push to OPA
    await axios.put(
      'http://opa:8181/v1/policies/eindhoven',
      rego,
      { headers: { 'Content-Type': 'text/plain' } }
    );
    console.log("Policy updated successfully");
    res.json({ success: true, status: "Policy Active" });
  } catch (e) {
    console.error("OPA Error:", e.message);
    res.status(500).json({ error: "Failed to update policy engine" });
  }
});

// 2. JWT Issuance Endpoint
app.post('/auth/token', (req, res) => {
  try {
    // Safely access nested attributes from the wallet data
    const attributes = req.body?.credentials?.[0]?.presentedAttributes;

    if (!attributes || !attributes.role || !attributes.gemeente) {
      return res.status(400).json({ error: "Invalid wallet data: missing role or gemeente attributes" });
    }

    // Create the JWT payload
    const payload = {
      role: attributes.role,
      gemeente: attributes.gemeente,
      // This 'key' is crucial for APISIX to identify the consumer
      key: 'paradym-user'
    };

    // Sign the token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    // Return the token to the client
    res.json({ token });

  } catch (error) {
    console.error("Token Generation Error:", error.message);
    res.status(500).json({ error: "Failed to generate token" });
  }
});


// 3. Data Access Endpoint (UPDATED to use JWT)
app.get('/data/test', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const input = {
        method: "GET",
        path: "/data/test",
        attributes: {
            role: decoded.role,
            gemeente: decoded.gemeente
        }
    };

  try {
    // Step A: Ask OPA for permission
    const opaResp = await axios.post('http://opa:8181/v1/data/httpauthz/decision', { input });
    
    if (opaResp.data.result === true) {
      // Step B: Access Granted - Fetch JSON Data
      const mockResp = await axios.get('http://mock-data/data.json');
      
      // Step C: Return clean JSON
      res.json(mockResp.data);
    } else {
      // Step D: Access Denied
      res.status(403).json({ 
        error: "Access Denied", 
        reason: "ODRL Policy constraints not met." 
      });
    }
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Internal System Error" });
  }
});

app.listen(3000, () => console.log('PAP Service running on port 3000'));
