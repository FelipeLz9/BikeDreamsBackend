// ==============================================
// BikeDreams Backend - Monitoring Service
// ==============================================
// This service provides monitoring and metrics collection
// for different environments with environment-specific configurations.

import logger from '../utils/logger';
import AlertManager from './alertManager';

// ==============================================
// Types and Interfaces
// ==============================================

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number;
  };
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errors: {
    total: number;
    rate: number;
    byType: Record<string, number>;
  };
  business: {
    users: number;
    posts: number;
    comments: number;
    likes: number;
  };
}

export interface DatabaseMetrics {
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
  };
  queries: {
    total: number;
    slow: number;
    averageTime: number;
  };
  size: {
    database: number;
    tables: Record<string, number>;
  };
  performance: {
    hitRate: number;
    missRate: number;
    lockWaits: number;
  };
}

export interface RedisMetrics {
  connections: {
    active: number;
    total: number;
    max: number;
  };
  memory: {
    used: number;
    peak: number;
    percentage: number;
  };
  operations: {
    total: number;
    perSecond: number;
    hitRate: number;
  };
  keys: {
    total: number;
    expired: number;
    evicted: number;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: boolean;
    redis: boolean;
    external: boolean;
    dependencies: boolean;
  };
  details: Record<string, any>;
}

// ==============================================
// Monitoring Service Class
// ==============================================

export class MonitoringService {
  private environment: 'development' | 'staging' | 'production';
  private alertManager: AlertManager;
  private metrics: Map<string, any> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private intervalId?: NodeJS.Timeout;

  constructor(environment: 'development' | 'staging' | 'production') {
    this.environment = environment;
    this.alertManager = new AlertManager(environment);
    this.startMonitoring();
  }

  // ==============================================
  // System Metrics Collection
  // ==============================================

  async collectSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    const usedMem = totalMem - freeMem;

    const cpuUsage = await this.getCpuUsage();
    const loadAverage = require('os').loadavg();

    const diskUsage = await this.getDiskUsage();
    const networkStats = await this.getNetworkStats();

    const metrics: SystemMetrics = {
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: loadAverage
      },
      disk: {
        used: diskUsage.used,
        total: diskUsage.total,
        percentage: (diskUsage.used / diskUsage.total) * 100
      },
      network: {
        bytesIn: networkStats.bytesIn,
        bytesOut: networkStats.bytesOut,
        packetsIn: networkStats.packetsIn,
        packetsOut: networkStats.packetsOut
      }
    };

    this.metrics.set('system', metrics);
    this.alertManager.updateMetric('memoryUsage', metrics.memory.percentage / 100);
    this.alertManager.updateMetric('cpuUsage', metrics.cpu.usage);

    return metrics;
  }

  // ==============================================
  // Application Metrics Collection
  // ==============================================

  async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    // This would typically come from your application's metrics collection
    const requests = this.metrics.get('requests') || { total: 0, successful: 0, failed: 0 };
    const responseTime = this.metrics.get('responseTime') || { average: 0, p50: 0, p95: 0, p99: 0 };
    const errors = this.metrics.get('errors') || { total: 0, byType: {} };
    const business = this.metrics.get('business') || { users: 0, posts: 0, comments: 0, likes: 0 };

    const metrics: ApplicationMetrics = {
      requests: {
        total: requests.total,
        successful: requests.successful,
        failed: requests.failed,
        rate: requests.total / (Date.now() - (this.metrics.get('startTime') || Date.now())) * 1000
      },
      responseTime: responseTime,
      errors: {
        total: errors.total,
        rate: errors.total / (Date.now() - (this.metrics.get('startTime') || Date.now())) * 1000,
        byType: errors.byType
      },
      business: business
    };

    this.metrics.set('application', metrics);
    this.alertManager.updateMetric('errorRate', metrics.errors.rate);
    this.alertManager.updateMetric('responseTime', metrics.responseTime.average);

    return metrics;
  }

  // ==============================================
  // Database Metrics Collection
  // ==============================================

  async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    // This would typically come from your database monitoring
    const connections = this.metrics.get('dbConnections') || { active: 0, idle: 0, total: 0, max: 100 };
    const queries = this.metrics.get('dbQueries') || { total: 0, slow: 0, averageTime: 0 };
    const size = this.metrics.get('dbSize') || { database: 0, tables: {} };
    const performance = this.metrics.get('dbPerformance') || { hitRate: 0, missRate: 0, lockWaits: 0 };

    const metrics: DatabaseMetrics = {
      connections: connections,
      queries: queries,
      size: size,
      performance: performance
    };

    this.metrics.set('database', metrics);
    this.alertManager.updateMetric('databaseConnections', connections.active);

    return metrics;
  }

  // ==============================================
  // Redis Metrics Collection
  // ==============================================

  async collectRedisMetrics(): Promise<RedisMetrics> {
    // This would typically come from your Redis monitoring
    const connections = this.metrics.get('redisConnections') || { active: 0, total: 0, max: 1000 };
    const memory = this.metrics.get('redisMemory') || { used: 0, peak: 0, percentage: 0 };
    const operations = this.metrics.get('redisOperations') || { total: 0, perSecond: 0, hitRate: 0 };
    const keys = this.metrics.get('redisKeys') || { total: 0, expired: 0, evicted: 0 };

    const metrics: RedisMetrics = {
      connections: connections,
      memory: memory,
      operations: operations,
      keys: keys
    };

    this.metrics.set('redis', metrics);
    this.alertManager.updateMetric('redisConnections', connections.active);

    return metrics;
  }

  // ==============================================
  // Health Checks
  // ==============================================

  async performHealthCheck(): Promise<HealthCheck> {
    const checks = {
      database: await this.checkDatabaseHealth(),
      redis: await this.checkRedisHealth(),
      external: await this.checkExternalHealth(),
      dependencies: await this.checkDependenciesHealth()
    };

    const allHealthy = Object.values(checks).every(check => check === true);
    const someHealthy = Object.values(checks).some(check => check === true);

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy) {
      status = 'healthy';
    } else if (someHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const healthCheck: HealthCheck = {
      status,
      timestamp: new Date(),
      checks,
      details: {
        system: await this.collectSystemMetrics(),
        application: await this.collectApplicationMetrics(),
        database: await this.collectDatabaseMetrics(),
        redis: await this.collectRedisMetrics()
      }
    };

    this.healthChecks.set('main', healthCheck);
    this.alertManager.updateMetric('healthCheck', allHealthy);

    return healthCheck;
  }

  // ==============================================
  // Individual Health Check Methods
  // ==============================================

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // This would typically check database connectivity
      // For now, we'll simulate a check
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      // This would typically check Redis connectivity
      // For now, we'll simulate a check
      return true;
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      return false;
    }
  }

  private async checkExternalHealth(): Promise<boolean> {
    try {
      // This would typically check external service dependencies
      // For now, we'll simulate a check
      return true;
    } catch (error) {
      logger.error('External health check failed', { error: error.message });
      return false;
    }
  }

  private async checkDependenciesHealth(): Promise<boolean> {
    try {
      // This would typically check all application dependencies
      // For now, we'll simulate a check
      return true;
    } catch (error) {
      logger.error('Dependencies health check failed', { error: error.message });
      return false;
    }
  }

  // ==============================================
  // Monitoring Control
  // ==============================================

  private startMonitoring(): void {
    const interval = this.getMonitoringInterval();
    
    this.intervalId = setInterval(async () => {
      try {
        await this.collectAllMetrics();
        await this.performHealthCheck();
        this.alertManager.checkThresholds();
      } catch (error) {
        logger.error('Monitoring collection failed', { error: error.message });
      }
    }, interval);

    logger.info('Monitoring started', { 
      environment: this.environment, 
      interval: interval 
    });
  }

  private stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info('Monitoring stopped', { environment: this.environment });
  }

  private getMonitoringInterval(): number {
    switch (this.environment) {
      case 'development':
        return 60000; // 1 minute
      case 'staging':
        return 30000; // 30 seconds
      case 'production':
        return 60000; // 1 minute
      default:
        return 60000; // 1 minute
    }
  }

  private async collectAllMetrics(): Promise<void> {
    await Promise.all([
      this.collectSystemMetrics(),
      this.collectApplicationMetrics(),
      this.collectDatabaseMetrics(),
      this.collectRedisMetrics()
    ]);
  }

  // ==============================================
  // Utility Methods
  // ==============================================

  private async getCpuUsage(): Promise<number> {
    // This would typically use a proper CPU monitoring library
    // For now, we'll simulate CPU usage
    return Math.random() * 100;
  }

  private async getDiskUsage(): Promise<{ used: number; total: number }> {
    // This would typically use a proper disk monitoring library
    // For now, we'll simulate disk usage
    return {
      used: 1000000000, // 1GB
      total: 10000000000 // 10GB
    };
  }

  private async getNetworkStats(): Promise<{
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  }> {
    // This would typically use a proper network monitoring library
    // For now, we'll simulate network stats
    return {
      bytesIn: 1000000,
      bytesOut: 1000000,
      packetsIn: 1000,
      packetsOut: 1000
    };
  }

  // ==============================================
  // Public API Methods
  // ==============================================

  getMetrics(): Map<string, any> {
    return this.metrics;
  }

  getHealthChecks(): Map<string, HealthCheck> {
    return this.healthChecks;
  }

  getAlertManager(): AlertManager {
    return this.alertManager;
  }

  async getPrometheusMetrics(): Promise<string> {
    // This would generate Prometheus-formatted metrics
    const system = this.metrics.get('system');
    const application = this.metrics.get('application');
    const database = this.metrics.get('database');
    const redis = this.metrics.get('redis');

    let metrics = '# HELP bikedreams_system_memory_usage_percentage System memory usage percentage\n';
    metrics += '# TYPE bikedreams_system_memory_usage_percentage gauge\n';
    metrics += `bikedreams_system_memory_usage_percentage{environment="${this.environment}"} ${system?.memory.percentage || 0}\n`;

    metrics += '# HELP bikedreams_system_cpu_usage System CPU usage percentage\n';
    metrics += '# TYPE bikedreams_system_cpu_usage gauge\n';
    metrics += `bikedreams_system_cpu_usage{environment="${this.environment}"} ${system?.cpu.usage || 0}\n`;

    metrics += '# HELP bikedreams_application_requests_total Total number of requests\n';
    metrics += '# TYPE bikedreams_application_requests_total counter\n';
    metrics += `bikedreams_application_requests_total{environment="${this.environment}"} ${application?.requests.total || 0}\n`;

    metrics += '# HELP bikedreams_application_response_time_average Average response time in milliseconds\n';
    metrics += '# TYPE bikedreams_application_response_time_average gauge\n';
    metrics += `bikedreams_application_response_time_average{environment="${this.environment}"} ${application?.responseTime.average || 0}\n`;

    return metrics;
  }

  // ==============================================
  // Cleanup
  // ==============================================

  destroy(): void {
    this.stopMonitoring();
    logger.info('Monitoring service destroyed', { environment: this.environment });
  }
}

// ==============================================
// Export Default Instance
// ==============================================

export default MonitoringService;
