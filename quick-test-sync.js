// Simple test to verify scraperIntegration service works
import { scraperIntegrationService } from './src/services/scraperIntegration.js';

console.log('🧪 Testing scraperIntegration service...');

async function testService() {
  try {
    // Test health check
    console.log('\n1. Testing health check...');
    const health = await scraperIntegrationService.checkScraperHealth();
    console.log('Health result:', health);
    
    // Test fetch events
    console.log('\n2. Testing fetch events...');
    const events = await scraperIntegrationService.fetchEventsFromScraper();
    console.log('Events result:', {
      usabmx: events.usabmx.length,
      uci: events.uci.length
    });
    
    // Test fetch news
    console.log('\n3. Testing fetch news...');
    const news = await scraperIntegrationService.fetchNewsFromScraper();
    console.log('News result:', {
      usabmx: news.usabmx.length,
      uci: news.uci.length
    });
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testService();
