#!/usr/bin/env node
import { scraperIntegrationService } from '../src/services/scraperIntegration';

async function debugSync() {
  console.log('🔍 Debugging sync issue...\n');

  try {
    // 1. Test health check
    console.log('1️⃣ Testing health check...');
    const health = await scraperIntegrationService.checkScraperHealth();
    console.log('Health check result:', health);

    // 2. Test fetch events directly
    console.log('\n2️⃣ Testing fetchEventsFromScraper...');
    const eventsData = await scraperIntegrationService.fetchEventsFromScraper();
    console.log('Events data structure:');
    console.log('  - usabmx type:', typeof eventsData.usabmx);
    console.log('  - usabmx length:', Array.isArray(eventsData.usabmx) ? eventsData.usabmx.length : 'NOT ARRAY');
    console.log('  - uci type:', typeof eventsData.uci);
    console.log('  - uci length:', Array.isArray(eventsData.uci) ? eventsData.uci.length : 'NOT ARRAY');
    
    if (!Array.isArray(eventsData.usabmx)) {
      console.log('❌ USABMX data:', eventsData.usabmx);
    }
    if (!Array.isArray(eventsData.uci)) {
      console.log('❌ UCI data:', eventsData.uci);
    }

    // 3. Test fetch news directly
    console.log('\n3️⃣ Testing fetchNewsFromScraper...');
    const newsData = await scraperIntegrationService.fetchNewsFromScraper();
    console.log('News data structure:');
    console.log('  - usabmx type:', typeof newsData.usabmx);
    console.log('  - usabmx length:', Array.isArray(newsData.usabmx) ? newsData.usabmx.length : 'NOT ARRAY');
    console.log('  - uci type:', typeof newsData.uci);
    console.log('  - uci length:', Array.isArray(newsData.uci) ? newsData.uci.length : 'NOT ARRAY');
    
    if (!Array.isArray(newsData.usabmx)) {
      console.log('❌ USABMX news:', newsData.usabmx);
    }
    if (!Array.isArray(newsData.uci)) {
      console.log('❌ UCI news:', newsData.uci);
    }

    // 4. Test direct fetch calls
    console.log('\n4️⃣ Testing direct API calls...');
    
    const SCRAPER_API_URL = process.env.SCRAPER_API_URL || 'http://localhost:4000';
    
    console.log('Testing USABMX events...');
    const usabmxResponse = await fetch(`${SCRAPER_API_URL}/events/usabmx/`);
    if (usabmxResponse.ok) {
      const usabmxData = await usabmxResponse.json();
      console.log('  - Response type:', typeof usabmxData);
      console.log('  - Has events property:', 'events' in usabmxData);
      console.log('  - Events length:', usabmxData?.events?.length || 'NO EVENTS');
    } else {
      console.log('  ❌ USABMX request failed:', usabmxResponse.status);
    }

    console.log('Testing UCI events...');
    const uciResponse = await fetch(`${SCRAPER_API_URL}/events/uci/`);
    if (uciResponse.ok) {
      const uciData = await uciResponse.json();
      console.log('  - Response type:', typeof uciData);
      console.log('  - Has events property:', 'events' in uciData);
      console.log('  - Events length:', uciData?.events?.length || 'NO EVENTS');
    } else {
      console.log('  ❌ UCI request failed:', uciResponse.status);
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

debugSync();
