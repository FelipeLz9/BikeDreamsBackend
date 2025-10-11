// Test script for advanced sync management system
import { syncManagerService } from './src/services/syncManager.js';

console.log('🧪 Testing advanced sync management system...');

async function testAdvancedSyncSystem() {
  try {
    
    console.log('\n1. 🔧 Creating test configuration...');
    const config = await syncManagerService.upsertConfiguration({
      name: 'Production Sync Config',
      description: 'Configuración de sincronización para producción',
      syncFrequency: 'daily',
      syncTime: '03:00',
      autoSyncEnabled: false, // Por ahora false hasta implementar scheduler
      notificationsEnabled: true,
      maxRetries: 3,
      timeoutMinutes: 30,
      cronExpression: '0 3 * * *'
    });
    console.log('✅ Configuration created:', {
      id: config.id,
      name: config.name,
      autoSyncEnabled: config.autoSyncEnabled
    });

    console.log('\n2. 🚀 Testing sync with logging...');
    const syncResult = await syncManagerService.executeSyncWithLogging(
      'all', // Sync type
      'manual', // Trigger type
      undefined, // No user
      config.id // Configuration ID
    );
    console.log('✅ Sync completed:', {
      success: syncResult.success,
      logId: syncResult.logId,
      events: syncResult.result?.events || 'N/A',
      news: syncResult.result?.news || 'N/A',
      errors: syncResult.result?.errors?.length || 0
    });

    console.log('\n3. 📊 Getting statistics...');
    const stats = await syncManagerService.getSyncStatistics(7);
    console.log('✅ Statistics (last 7 days):', {
      totalSyncs: stats.totalSyncs,
      successful: stats.successful,
      failed: stats.failed,
      successRate: Math.round(stats.successRate) + '%',
      totalEvents: stats.totalEvents,
      totalNews: stats.totalNews,
      avgDuration: Math.round(stats.averageDurationMs) + 'ms'
    });

    console.log('\n4. 📝 Getting recent logs...');
    const logsResult = await syncManagerService.getSyncLogs(1, 3);
    console.log('✅ Recent logs:', {
      total: logsResult.pagination.total,
      showing: logsResult.logs.length,
      logs: logsResult.logs.map(log => ({
        id: log.id,
        status: log.status,
        duration: log.durationMs + 'ms',
        eventsSynced: log.eventsSynced,
        newsSynced: log.newsSynced,
        errors: log.totalErrors
      }))
    });

    console.log('\n5. ⚙️  Getting configurations...');
    const configurations = await syncManagerService.getConfigurations();
    console.log('✅ Available configurations:', {
      total: configurations.length,
      configs: configurations.map(cfg => ({
        id: cfg.id,
        name: cfg.name,
        active: cfg.isActive,
        autoSync: cfg.autoSyncEnabled,
        totalLogs: cfg._count.logs
      }))
    });

    console.log('\n🎉 All advanced sync management tests completed successfully!');
    
    return {
      configurationCreated: true,
      syncExecuted: syncResult.success,
      statisticsGenerated: true,
      logsRetrieved: true,
      configurationsListed: true
    };

  } catch (error) {
    console.error('❌ Advanced sync management test failed:', error);
    throw error;
  }
}

testAdvancedSyncSystem()
  .then(results => {
    console.log('\n📋 Test Results Summary:');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed}`);
    });
  })
  .catch(error => {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  });
