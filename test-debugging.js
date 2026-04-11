#!/usr/bin/env node

/**
 * Test script to verify debugging setup between frontend and backend
 */

const http = require('http');

// Test data for registration
const testUser = {
    username: 'debugtest',
    email: 'debugtest@example.com',
    password: 'Test123!@#',
    password2: 'Test123!@#',
    first_name: 'Debug',
    last_name: 'Test',
    phone: '0712345678',
    role: 'farmer',
    county: 'Harare',
    location: 'Test Location'
};

console.log('🔍 TESTING DEBUGGING SETUP');
console.log('==========================');

// Test 1: Backend Health Check
function testHealthCheck() {
    return new Promise((resolve, reject) => {
        console.log('\n📊 Test 1: Backend Health Check');
        console.log('--------------------------------');
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/api/v1/health/',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            console.log(`Status Code: ${res.statusCode}`);
            console.log('Headers:', res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('Response:', response);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ Health check PASSED');
                        resolve();
                    } else {
                        console.log('❌ Health check FAILED');
                        reject(new Error(`Health check failed: ${res.statusCode}`));
                    }
                } catch (e) {
                    console.log('❌ Invalid JSON response');
                    reject(e);
                }
            });
        });

        req.on('error', (error) => {
            console.log('❌ Connection Error:', error.message);
            console.log('\n🔧 Solution: Start Django backend');
            console.log('   cd backend && python manage.py runserver 8000');
            reject(error);
        });

        req.end();
    });
}

// Test 2: CORS Preflight
function testCorsPreflight() {
    return new Promise((resolve, reject) => {
        console.log('\n🌐 Test 2: CORS Preflight Request');
        console.log('-----------------------------------');
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/api/v1/auth/register/',
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:8081',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        };

        const req = http.request(options, (res) => {
            console.log(`Status Code: ${res.statusCode}`);
            console.log('CORS Headers:');
            console.log(`  Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin']}`);
            console.log(`  Access-Control-Allow-Methods: ${res.headers['access-control-allow-methods']}`);
            console.log(`  Access-Control-Allow-Headers: ${res.headers['access-control-allow-headers']}`);
            console.log(`  Access-Control-Allow-Credentials: ${res.headers['access-control-allow-credentials']}`);
            
            if (res.statusCode === 200 && res.headers['access-control-allow-origin'] === 'http://localhost:8081') {
                console.log('✅ CORS preflight PASSED');
                resolve();
            } else {
                console.log('❌ CORS preflight FAILED');
                console.log('\n🔧 Solution: Check CORS settings in Django settings.py');
                reject(new Error('CORS preflight failed'));
            }
        });

        req.on('error', reject);
        req.end();
    });
}

// Test 3: Registration Endpoint
function testRegistration() {
    return new Promise((resolve, reject) => {
        console.log('\n🔐 Test 3: Registration Endpoint');
        console.log('-------------------------------');
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/api/v1/auth/register/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:8081'
            }
        };

        const req = http.request(options, (res) => {
            console.log(`Status Code: ${res.statusCode}`);
            console.log('Headers:', res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('Response:', response);
                    
                    if (res.statusCode === 201) {
                        console.log('✅ Registration endpoint PASSED');
                        console.log('📧 Email verification should be sent');
                        resolve();
                    } else {
                        console.log('❌ Registration endpoint FAILED');
                        console.log('Check backend logs for validation errors');
                        reject(new Error(`Registration failed: ${res.statusCode}`));
                    }
                } catch (e) {
                    console.log('❌ Invalid JSON response');
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        
        req.write(JSON.stringify(testUser));
        req.end();
    });
}

// Test 4: Login Endpoint
function testLogin() {
    return new Promise((resolve, reject) => {
        console.log('\n🔑 Test 4: Login Endpoint');
        console.log('--------------------------');
        
        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/api/v1/auth/login/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:8081'
            }
        };

        const req = http.request(options, (res) => {
            console.log(`Status Code: ${res.statusCode}`);
            console.log('Headers:', res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('Response:', response);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ Login endpoint PASSED');
                        console.log('🎉 Authentication successful');
                        resolve();
                    } else if (res.statusCode === 401) {
                        console.log('⚠️ Login failed (expected - email not verified)');
                        console.log('This is normal if email verification is required');
                        resolve();
                    } else {
                        console.log('❌ Login endpoint FAILED');
                        reject(new Error(`Login failed: ${res.statusCode}`));
                    }
                } catch (e) {
                    console.log('❌ Invalid JSON response');
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        
        const loginData = {
            email: testUser.email,
            password: testUser.password
        };
        
        req.write(JSON.stringify(loginData));
        req.end();
    });
}

// Run all tests
async function runAllTests() {
    try {
        await testHealthCheck();
        await testCorsPreflight();
        await testRegistration();
        await testLogin();
        
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('==================');
        console.log('✅ Backend is running correctly');
        console.log('✅ CORS is configured properly');
        console.log('✅ Registration endpoint works');
        console.log('✅ Login endpoint works');
        console.log('\n🚀 Frontend should now be able to communicate with backend!');
        console.log('\n📱 To test in the app:');
        console.log('1. Start frontend: npx expo start --port 8081');
        console.log('2. Open browser console (F12)');
        console.log('3. Try registering a new account');
        console.log('4. Watch for debugging logs in both console and terminal');
        
    } catch (error) {
        console.log('\n❌ TESTS FAILED');
        console.log('================');
        console.log('Error:', error.message);
        console.log('\n🔧 Check the DEBUG_DASHBOARD.md for troubleshooting steps');
        process.exit(1);
    }
}

// Execute tests
runAllTests();
