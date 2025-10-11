// Global teardown after all tests complete
module.exports = async () => {
  console.log('🧹 Cleaning up global test environment...');
  
  // You can add cleanup here if needed
  // For example, dropping test database, cleaning up files, etc.
  
  console.log('✅ Global test environment cleanup completed');
};
