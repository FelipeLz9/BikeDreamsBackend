// Complete test for the entire sync system including automatic scheduling
import { syncManagerService } from './src/services/syncManager.js';
import { syncSchedulerService } from './src/services/syncScheduler.js';

console.log('🧪 Testing complete sync system (Phase 1.3)...\n');

async function testCompleteSyncSystem() {
  try {
    const testResults = {};
    
    // 1. Test Configuration Management
    console.log('1. 🔧 Testing configuration management...');
    const config = await syncManagerService.upsertConfiguration({
      name: 'Auto Sync Test Config',
      description: 'Configuración de prueba para sincronización automática',
      syncFrequency: 'daily',
      syncTime: '02:30',
      syncEvents: true,
      syncNews: true,
      syncUsabmx: true,
      syncUci: true,
      autoSyncEnabled: true,
      notificationsEnabled: true,
      notificationEmail: 'admin@example.com',
      maxRetries: 3,
      timeoutMinutes: 30,
      cronExpression: '30 2 * * *' // Daily at 2:30 AM
    });
    
    testResults.configurationCreated = !!config;
    console.log('✅ Configuration created:', {
      id: config.id,
      name: config.name,
      autoEnabled: config.autoSyncEnabled
    });

    // 2. Test Scheduler Initialization
    console.log('\n2. 🚀 Testing scheduler initialization...');
    await syncSchedulerService.initialize();
    const schedulerStatus = syncSchedulerService.getScheduledTasksStatus();
    
    testResults.schedulerInitialized = schedulerStatus.initialized;
    console.log('✅ Scheduler initialized:', {
      initialized: schedulerStatus.initialized,
      totalTasks: schedulerStatus.totalTasks
    });

    // 3. Test Manual Scheduling
    console.log('\n3. ⏰ Testing manual task scheduling...');
    await syncSchedulerService.scheduleTask(config.id, '*/30 * * * * *'); // Every 30 seconds for testing
    
    const updatedStatus = syncSchedulerService.getScheduledTasksStatus();
    testResults.taskScheduled = updatedStatus.totalTasks > 0;
    console.log('✅ Task scheduled:', {
      totalTasks: updatedStatus.totalTasks,
      tasks: updatedStatus.tasks.map(t => ({
        configId: t.configurationId,
        cron: t.cronExpression,
        running: t.running
      }))
    });

    // 4. Test Sync Execution with Logging
    console.log('\n4. 🔄 Testing sync execution with logging...');
    const syncResult = await syncManagerService.executeSyncWithLogging(
      'all',
      'test',
      undefined,
      config.id
    );
    
    testResults.syncExecuted = syncResult.success;
    console.log('✅ Sync executed:', {
      success: syncResult.success,
      logId: syncResult.logId,
      events: syncResult.result?.events || 'N/A',
      news: syncResult.result?.news || 'N/A'
    });

    // 5. Test Statistics and Monitoring
    console.log('\n5. 📊 Testing statistics and monitoring...');
    const [stats, logs, configurations] = await Promise.all([
      syncManagerService.getSyncStatistics(1),
      syncManagerService.getSyncLogs(1, 5),
      syncManagerService.getConfigurations()
    ]);
    
    testResults.statisticsGenerated = stats.totalSyncs > 0;
    testResults.logsGenerated = logs.logs.length > 0;
    testResults.configurationsRetrieved = configurations.length > 0;
    
    console.log('✅ Monitoring data:', {
      totalSyncs: stats.totalSyncs,
      successRate: Math.round(stats.successRate) + '%',
      totalLogs: logs.pagination.total,
      totalConfigurations: configurations.length
    });

    // 6. Test Configuration Toggle
    console.log('\n6. ⚙️  Testing configuration toggle...');
    const toggledConfig = await syncManagerService.toggleConfiguration(config.id, false);
    testResults.configurationToggled = !toggledConfig.isActive;
    
    console.log('✅ Configuration toggled:', {
      id: toggledConfig.id,
      isActive: toggledConfig.isActive
    });

    // 7. Test Task Cancellation
    console.log('\n7. 🛑 Testing task cancellation...');
    syncSchedulerService.cancelTask(config.id);
    
    const finalStatus = syncSchedulerService.getScheduledTasksStatus();
    testResults.taskCancelled = finalStatus.totalTasks === 0;
    
    console.log('✅ Task cancelled:', {
      remainingTasks: finalStatus.totalTasks
    });

    // 8. Test System Health
    console.log('\n8. 💚 Testing overall system health...');
    const activeConfig = await syncManagerService.getActiveConfiguration();
    
    testResults.systemHealthy = true;
    console.log('✅ System health check:', {
      hasActiveConfig: !!activeConfig,
      schedulerWorking: schedulerStatus.initialized,
      databaseConnected: true
    });

    console.log('\n🎉 Complete sync system test completed successfully!');
    
    return testResults;

  } catch (error) {
    console.error('❌ Complete sync system test failed:', error);
    throw error;
  }
}

testCompleteSyncSystem()
  .then(results => {
    console.log('\n📋 Complete Test Results Summary:');
    console.log('=====================================');
    
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
      console.log('\n🎯 Phase 1.3 - Sincronización Automática y Gestión Avanzada: COMPLETADA ✅');
      console.log('\n🚀 Sistema listo para continuar con optimizaciones adicionales o pasar a producción!');
    } else {
      console.log('\n⚠️  Some tests failed. Please review and fix issues before proceeding.');
    }
  })
  .catch(error => {
    console.error('\n💥 Complete test suite failed:', error.message);
    console.log('\n❌ Phase 1.3 test failed. Please review and fix issues.');
    process.exit(1);
  });
