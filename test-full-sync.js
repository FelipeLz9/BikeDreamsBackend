// Test full sync to database
import { scraperIntegrationService } from './src/services/scraperIntegration.js';

console.log('🧪 Testing full sync to database...');

async function testFullSync() {
  try {
    console.log('\n🚀 Starting full sync...');
    const result = await scraperIntegrationService.syncAll();
    
    console.log('\n📊 Sync Results:');
    console.log('- Success:', result.success);
    console.log('- Events USABMX:', result.events.usabmx);
    console.log('- Events UCI:', result.events.uci);
    console.log('- News USABMX:', result.news.usabmx);
    console.log('- News UCI:', result.news.uci);
    console.log('- Total errors:', result.errors.length);
    
    if (result.errors.length > 0) {
      console.log('\n⚠️ Errors found:');
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }
    
    console.log('\n✅ Full sync test completed!');
  } catch (error) {
    console.error('❌ Full sync test failed:', error);
  }
}

testFullSync();
