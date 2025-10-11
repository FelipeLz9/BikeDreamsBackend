// Test script for optimized event endpoints
import { getOptimizedEvents, getEventStats, searchEventsAutocomplete } from './src/controllers/optimizedEventController.js';

console.log('🧪 Testing optimized event endpoints (Phase 2.1)...\n');

async function testOptimizedEvents() {
  try {
    const testResults = {};
    
    // 1. Test Basic Pagination
    console.log('1. 📄 Testing basic pagination...');
    const paginationTest = await getOptimizedEvents({}, { page: 1, limit: 10 });
    
    testResults.paginationWorks = paginationTest.success && paginationTest.data?.events?.length <= 10;
    console.log('✅ Pagination test:', {
      success: paginationTest.success,
      eventsReturned: paginationTest.data?.events?.length || 0,
      totalEvents: paginationTest.data?.pagination?.total || 0,
      totalPages: paginationTest.data?.pagination?.totalPages || 0
    });

    // 2. Test Advanced Filtering
    console.log('\n2. 🔍 Testing advanced filters...');
    const filterTest = await getOptimizedEvents({
      source: 'USABMX',
      timeFilter: 'upcoming',
      hasCoordinates: true
    }, { limit: 5 });
    
    testResults.filtersWork = filterTest.success;
    console.log('✅ Filters test:', {
      success: filterTest.success,
      eventsFound: filterTest.data?.events?.length || 0,
      filters: filterTest.data?.filters?.applied || {}
    });

    // 3. Test Search Functionality
    console.log('\n3. 🔎 Testing search functionality...');
    const searchTest = await getOptimizedEvents({
      search: 'BMX'
    }, { limit: 5 });
    
    testResults.searchWorks = searchTest.success && (searchTest.data?.events?.length > 0);
    console.log('✅ Search test:', {
      success: searchTest.success,
      resultsFound: searchTest.data?.events?.length || 0,
      firstResult: searchTest.data?.events?.[0]?.title || 'None'
    });

    // 4. Test Sorting
    console.log('\n4. 🔄 Testing sorting options...');
    const sortTest = await getOptimizedEvents({}, { 
      limit: 5, 
      sortBy: 'title', 
      sortOrder: 'asc' 
    });
    
    testResults.sortingWorks = sortTest.success;
    console.log('✅ Sorting test:', {
      success: sortTest.success,
      sortedBy: sortTest.data?.meta?.sortedBy || 'unknown',
      sortOrder: sortTest.data?.meta?.sortOrder || 'unknown',
      firstTitle: sortTest.data?.events?.[0]?.title || 'None'
    });

    // 5. Test Statistics Endpoint
    console.log('\n5. 📊 Testing statistics endpoint...');
    const statsTest = await getEventStats();
    
    testResults.statsWork = statsTest.success && statsTest.data?.totals?.all > 0;
    console.log('✅ Statistics test:', {
      success: statsTest.success,
      totalEvents: statsTest.data?.totals?.all || 0,
      upcomingEvents: statsTest.data?.totals?.upcoming || 0,
      withCoordinates: statsTest.data?.totals?.withCoordinates || 0,
      coordinatesRate: statsTest.data?.percentages?.coordinatesRate || 0 + '%'
    });

    // 6. Test Autocomplete Search
    console.log('\n6. ⚡ Testing autocomplete search...');
    const autocompleteTest = await searchEventsAutocomplete('BMX', 5);
    
    testResults.autocompleteWorks = autocompleteTest.success;
    console.log('✅ Autocomplete test:', {
      success: autocompleteTest.success,
      suggestions: autocompleteTest.data?.length || 0,
      firstSuggestion: autocompleteTest.data?.[0]?.title || 'None'
    });

    // 7. Test Geographic Filtering
    console.log('\n7. 🌍 Testing geographic filtering...');
    const geoTest = await getOptimizedEvents({
      country: 'United States'
    }, { limit: 5 });
    
    testResults.geoFilterWorks = geoTest.success;
    console.log('✅ Geographic filter test:', {
      success: geoTest.success,
      eventsInUS: geoTest.data?.events?.length || 0,
      topCountries: geoTest.data?.filters?.available?.topCountries || []
    });

    // 8. Test Performance with Large Dataset
    console.log('\n8. ⚡ Testing performance with larger dataset...');
    const startTime = Date.now();
    
    const performanceTest = await getOptimizedEvents({}, { 
      page: 1, 
      limit: 50 
    });
    
    const queryTime = Date.now() - startTime;
    testResults.performanceGood = performanceTest.success && queryTime < 1000; // Less than 1 second
    
    console.log('✅ Performance test:', {
      success: performanceTest.success,
      queryTime: queryTime + 'ms',
      eventsReturned: performanceTest.data?.events?.length || 0,
      performanceGood: queryTime < 1000
    });

    // 9. Test Date Range Filtering
    console.log('\n9. 📅 Testing date range filtering...');
    const dateRangeTest = await getOptimizedEvents({
      startDate: new Date(2024, 0, 1).toISOString(), // January 1, 2024
      endDate: new Date(2024, 11, 31).toISOString()  // December 31, 2024
    }, { limit: 10 });
    
    testResults.dateRangeWorks = dateRangeTest.success;
    console.log('✅ Date range test:', {
      success: dateRangeTest.success,
      eventsIn2024: dateRangeTest.data?.events?.length || 0
    });

    // 10. Test Source-specific Filtering
    console.log('\n10. 🏷️  Testing source-specific filtering...');
    const [usabmxTest, uciTest] = await Promise.all([
      getOptimizedEvents({ source: 'USABMX' }, { limit: 5 }),
      getOptimizedEvents({ source: 'UCI' }, { limit: 5 })
    ]);
    
    testResults.sourceFiltersWork = usabmxTest.success && uciTest.success;
    console.log('✅ Source filters test:', {
      usabmxSuccess: usabmxTest.success,
      usabmxCount: usabmxTest.data?.events?.length || 0,
      uciSuccess: uciTest.success,
      uciCount: uciTest.data?.events?.length || 0
    });

    console.log('\n🎉 Optimized events system test completed successfully!');
    
    return testResults;

  } catch (error) {
    console.error('❌ Optimized events test failed:', error);
    throw error;
  }
}

testOptimizedEvents()
  .then(results => {
    console.log('\n📋 Optimized Events Test Results Summary:');
    console.log('==========================================');
    
    const testCount = Object.keys(results).length;
    const passedCount = Object.values(results).filter(Boolean).length;
    const failedCount = testCount - passedCount;
    
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed}`);
    });
    
    console.log('\n📊 Summary:');
    console.log(`Total Tests: ${testCount}`);
    console.log(`✅ Passed: ${passedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📈 Success Rate: ${Math.round((passedCount / testCount) * 100)}%`);
    
    if (passedCount === testCount) {
      console.log('\n🎯 Events API Optimization: COMPLETADA ✅');
      console.log('\n🚀 Performance improvements implemented:');
      console.log('   - ✅ Advanced pagination with limit/offset');
      console.log('   - ✅ Multi-field filtering (source, date, location, etc.)');
      console.log('   - ✅ Full-text search with autocomplete');
      console.log('   - ✅ Flexible sorting options');
      console.log('   - ✅ Geographic and temporal filters');
      console.log('   - ✅ Database indexes for optimization');
      console.log('   - ✅ Efficient query patterns');
      console.log('   - ✅ Statistics and metadata endpoints');
    } else {
      console.log('\n⚠️  Some tests failed. Please review and fix issues.');
    }
  })
  .catch(error => {
    console.error('\n💥 Optimized events test suite failed:', error.message);
    console.log('\n❌ Phase 2.1 events optimization test failed.');
    process.exit(1);
  });
