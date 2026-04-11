#!/usr/bin/env node

// Simple script to test Django backend connection
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/api/v1/health/',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response Body: ${data}`);
    
    if (res.statusCode === 200) {
      console.log('✅ Backend is running and accessible!');
    } else {
      console.log('❌ Backend responded with an error');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Connection Error:', error.message);
  console.log('\n🔧 Troubleshooting steps:');
  console.log('1. Make sure Django backend is running on port 8000');
  console.log('2. Run: cd backend && python manage.py runserver 8000');
  console.log('3. Check if port 8000 is already in use');
  console.log('4. Verify Django settings allow connections from your IP');
});

req.end();
