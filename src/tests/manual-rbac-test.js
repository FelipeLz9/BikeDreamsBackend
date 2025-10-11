#!/usr/bin/env node

/**
 * Manual RBAC Middleware Test Script
 * This script will make real HTTP requests to test if the RBAC middleware works
 * Run with: node src/tests/manual-rbac-test.js
 */

// Try to use native fetch (Node 18+) or fallback to require
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) {
    fetch = require('node-fetch').default || require('node-fetch');
  }
} catch (e) {
  console.log('⚠️  Fetch not available, using curl fallback');
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details) {
  const symbol = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${symbol} ${testName}`, color);
  if (details) log(`   ${details}`, 'yellow');
  
  testResults.tests.push({ testName, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

async function makeRequest(path, options = {}) {
  try {
    const url = `${BASE_URL}${path}`;
    log(`Making request: ${options.method || 'GET'} ${path}`, 'blue');
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const status = response.status;
    let body;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    
    log(`Response: ${status}`, status < 400 ? 'green' : 'red');
    log(`Body: ${JSON.stringify(body).substring(0, 200)}...`, 'yellow');
    
    return { status, body, response };
  } catch (error) {
    log(`Request failed: ${error.message}`, 'red');
    return { status: 0, body: null, error };
  }
}

async function testHealthCheck() {
  log('\n🏥 Testing Health Check (should work without auth)', 'bold');
  const result = await makeRequest('/health');
  logTest('Health Check', result.status === 200, `Status: ${result.status}`);
  return result.status === 200;
}

async function testRBACWithoutAuth() {
  log('\n🔒 Testing RBAC without authentication (should fail)', 'bold');
  const result = await makeRequest('/rbac/my-permissions');
  const passed = result.status === 401;
  logTest('RBAC without auth', passed, `Expected 401, got ${result.status}`);
  return passed;
}

async function testRBACWithInvalidToken() {
  log('\n🔓 Testing RBAC with invalid token (should fail)', 'bold');
  const result = await makeRequest('/rbac/my-permissions', {
    headers: { 'Authorization': 'Bearer invalid-token' }
  });
  const passed = result.status === 401;
  logTest('RBAC with invalid token', passed, `Expected 401, got ${result.status}`);
  return passed;
}

async function testServerIsRunning() {
  log('\n🚀 Checking if server is running...', 'bold');
  const result = await makeRequest('/');
  const passed = result.status === 200 || result.status === 404; // Either works or 404 is fine
  logTest('Server running', passed, `Status: ${result.status}`);
  return passed;
}

async function testRBACRouteExists() {
  log('\n🔍 Testing if RBAC routes exist', 'bold');
  const result = await makeRequest('/rbac/roles');
  // Should return 401 (needs auth) rather than 404 (route not found)
  const passed = result.status !== 404;
  logTest('RBAC routes exist', passed, `Status: ${result.status} (404 would mean route doesn't exist)`);
  return passed;
}

async function testAuthMiddlewareLayer() {
  log('\n🛡️ Testing Auth Middleware Layer', 'bold');
  
  // Test multiple RBAC endpoints to see if auth is working
  const endpoints = ['/rbac/roles', '/rbac/permissions', '/rbac/stats'];
  let allWorking = true;
  
  for (const endpoint of endpoints) {
    const result = await makeRequest(endpoint);
    const working = result.status === 401; // Should require auth
    if (!working) allWorking = false;
    logTest(`Auth middleware on ${endpoint}`, working, `Status: ${result.status}`);
  }
  
  return allWorking;
}

async function testRoleBasedAccess() {
  log('\n👥 Testing Role-Based Access (theoretical)', 'bold');
  
  // Since we don't have real tokens, we test that the middleware structure exists
  const result = await makeRequest('/rbac/initialize', { method: 'POST' });
  
  // Should get 401 (needs auth) or 403 (needs proper role), NOT 404 or 500
  const passed = [401, 403].includes(result.status);
  logTest('Role-based endpoint structure', passed, 
    `Status: ${result.status} (401/403 = middleware working, 404 = missing, 500 = broken)`);
  return passed;
}

function printSummary() {
  log('\n📊 Test Summary', 'bold');
  log(`Total Tests: ${testResults.tests.length}`);
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, 'red');
  
  if (testResults.failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    testResults.tests.filter(t => !t.passed).forEach(t => {
      log(`  - ${t.testName}: ${t.details}`, 'red');
    });
  }
  
  const overallResult = testResults.failed === 0 ? 'PASS' : 'FAIL';
  const resultColor = testResults.failed === 0 ? 'green' : 'red';
  log(`\n🎯 Overall Result: ${overallResult}`, resultColor);
  
  return testResults.failed === 0;
}

function getConclusion(allPassed) {
  if (allPassed) {
    log('\n🎉 RBAC Middleware appears to be working correctly!', 'green');
    log('✅ Authentication layer is active', 'green');
    log('✅ Routes are properly protected', 'green');
    log('✅ Error handling is working', 'green');
    log('\n💡 The middleware is likely functioning as expected in production.', 'blue');
  } else {
    log('\n⚠️  Some issues detected with RBAC Middleware:', 'yellow');
    log('Please check the failed tests above for specific issues.', 'yellow');
    log('\n🔧 Possible issues:', 'yellow');
    log('- Server not running (start with: npm run dev)', 'yellow');
    log('- Routes not properly configured', 'yellow');
    log('- Middleware not applied correctly', 'yellow');
    log('- Database/service dependencies missing', 'yellow');
  }
}

async function runAllTests() {
  log('🧪 Manual RBAC Middleware Test Suite', 'bold');
  log('=====================================\n', 'bold');
  
  const tests = [
    testServerIsRunning,
    testHealthCheck,
    testRBACRouteExists,
    testRBACWithoutAuth,
    testRBACWithInvalidToken,
    testAuthMiddlewareLayer,
    testRoleBasedAccess
  ];
  
  let allPassed = true;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (!result) allPassed = false;
    } catch (error) {
      log(`Test failed with error: ${error.message}`, 'red');
      allPassed = false;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const summaryPassed = printSummary();
  getConclusion(allPassed && summaryPassed);
  
  return allPassed && summaryPassed;
}

// Instructions
async function showInstructions() {
  log('📋 Instructions:', 'bold');
  log('1. Start the server in another terminal: npm run dev', 'blue');
  log('2. Wait for server to start (should show port 3001)', 'blue');
  log('3. Run this test: node src/tests/manual-rbac-test.js', 'blue');
  log('4. Check the results below\n', 'blue');
  
  // Wait a moment for user to read
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Main execution
async function main() {
  await showInstructions();
  
  const success = await runAllTests();
  
  log('\n🏁 Test completed!', 'bold');
  process.exit(success ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  log(`\n💥 Unhandled error: ${error.message}`, 'red');
  log('This might indicate a serious issue with the middleware or server.', 'red');
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    log(`\n💥 Script failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runAllTests, makeRequest };