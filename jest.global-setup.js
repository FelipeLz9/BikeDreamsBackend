// Global setup before all tests run
module.exports = async () => {
  // Set global environment variables
  process.env.NODE_ENV = 'test';
  process.env.TZ = 'UTC';
  
  console.log('🚀 Setting up global test environment...');
  
  // You can add database setup here if needed
  // For example, creating test database, running migrations, etc.
  
  console.log('✅ Global test environment setup completed');
};
