const jwt = require('jsonwebtoken');

const payload = {
  role: 'Finance', // Incorrect role
  gemeente: 'Eindhoven'
};

const secret = 'a-secure-key-for-testing';

const token = jwt.sign(payload, secret);

console.log(token);
