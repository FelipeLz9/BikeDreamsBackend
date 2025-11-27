// ==============================================
// BikeDreams Backend - Staging Logging Configuration
// ==============================================
// This file contains staging-specific logging configurations
// optimized for testing and pre-production monitoring.

export const stagingLoggingConfig = {
  // ==============================================
  // General Configuration
  // ==============================================
  level: 'info',
  enableConsole: true,
  enableFile: true,
  enableRemote: true,
  
  // ==============================================
  // Console Configuration
  // ==============================================
  console: {
    enabled: true,
    level: 'info',
    colorize: true,
    timestamp: true,
    format: 'standard',
    showStack: false,
    showContext: true,
    maxContextDepth: 2
  },
  
  // ==============================================
  // File Configuration
  // ==============================================
  file: {
    enabled: true,
    level: 'info',
    maxFiles: 10,
    maxSize: '50MB',
    datePattern: 'YYYY-MM-DD',
    compress: true,
    directory: 'logs/staging',
    filename: 'app-%DATE%.log',
    errorFilename: 'error-%DATE%.log',
    auditFilename: 'audit-%DATE%.log',
    securityFilename: 'security-%DATE%.log'
  },
  
  // ==============================================
  // Remote Configuration (Loki, ELK, etc.)
  // ==============================================
  remote: {
    enabled: true,
    type: 'loki',
    endpoint: process.env.LOKI_ENDPOINT || 'http://loki:3100/loki/api/v1/push',
    level: 'info',
    labels: {
      environment: 'staging',
      service: 'bikedreams-backend',
      version: process.env.APP_VERSION || '1.0.0'
    },
    batchSize: 100,
    batchTimeout: 5000
  },
  
  // ==============================================
  // Log Levels Configuration
  // ==============================================
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5
  },
  
  // ==============================================
  // Staging-Specific Features
  // ==============================================
  features: {
    // Enable request logging
    requestLogging: true,
    requestDetails: {
      headers: false,
      body: false,
      query: true,
      params: true,
      response: false,
      timing: true
    },
    
    // Enable database query logging
    databaseLogging: true,
    databaseDetails: {
      queries: false,
      parameters: false,
      timing: true,
      results: false
    },
    
    // Enable security event logging
    securityLogging: true,
    securityDetails: {
      authAttempts: true,
      permissionChecks: true,
      rateLimiting: true,
      suspiciousActivity: true
    },
    
    // Enable performance logging
    performanceLogging: true,
    performanceDetails: {
      memoryUsage: true,
      cpuUsage: true,
      responseTime: true,
      throughput: true
    },
    
    // Enable testing features
    testing: {
      testLogs: true,
      mockLogs: true,
      integrationLogs: true
    }
  },
  
  // ==============================================
  // Format Configuration
  // ==============================================
  format: {
    timestamp: 'YYYY-MM-DD HH:mm:ss.SSS',
    timezone: 'UTC',
    json: true,
    prettyPrint: false,
    colorize: false,
    includeLevel: true,
    includeMessage: true,
    includeTimestamp: true,
    includeContext: true
  },
  
  // ==============================================
  // Filter Configuration
  // ==============================================
  filters: {
    // Include relevant log levels
    includeLevels: ['error', 'warn', 'info', 'http'],
    
    // Include all modules
    includeModules: ['*'],
    
    // Exclude specific patterns
    excludePatterns: [
      'healthcheck',
      'metrics',
      'debug'
    ],
    
    // Include specific patterns
    includePatterns: [
      'auth',
      'database',
      'security',
      'performance',
      'api',
      'business'
    ]
  },
  
  // ==============================================
  // Alert Configuration
  // ==============================================
  alerts: {
    enabled: true,
    channels: ['email', 'slack', 'webhook'],
    thresholds: {
      errorRate: 0.05, // 5% error rate
      responseTime: 3000, // 3 seconds
      memoryUsage: 0.7, // 70% memory usage
      cpuUsage: 0.7, // 70% CPU usage
      securityEvents: 10 // 10 security events per minute
    },
    
    // Alert rules
    rules: [
      {
        name: 'High Error Rate',
        condition: 'errorRate > 0.05',
        severity: 'warning',
        cooldown: 300000 // 5 minutes
      },
      {
        name: 'High Response Time',
        condition: 'responseTime > 3000',
        severity: 'warning',
        cooldown: 300000 // 5 minutes
      },
      {
        name: 'High Memory Usage',
        condition: 'memoryUsage > 0.7',
        severity: 'critical',
        cooldown: 600000 // 10 minutes
      },
      {
        name: 'Security Event Spike',
        condition: 'securityEvents > 10',
        severity: 'critical',
        cooldown: 60000 // 1 minute
      }
    ]
  },
  
  // ==============================================
  // Monitoring Configuration
  // ==============================================
  monitoring: {
    enabled: true,
    metrics: {
      enabled: true,
      interval: 30000, // 30 seconds
      includeSystem: true,
      includeApplication: true,
      includeDatabase: true,
      includeRedis: true,
      includeExternal: true
    },
    
    healthChecks: {
      enabled: true,
      interval: 30000, // 30 seconds
      includeDatabase: true,
      includeRedis: true,
      includeExternal: true,
      includeDependencies: true
    },
    
    // Prometheus metrics
    prometheus: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      collectDefaultMetrics: true,
      customMetrics: true
    }
  },
  
  // ==============================================
  // Staging Tools
  // ==============================================
  tools: {
    // Enable log viewer
    logViewer: {
      enabled: true,
      port: 3002,
      path: '/logs',
      authentication: true
    },
    
    // Enable metrics dashboard
    metricsDashboard: {
      enabled: true,
      port: 3003,
      path: '/metrics',
      authentication: true
    },
    
    // Enable Grafana integration
    grafana: {
      enabled: true,
      endpoint: process.env.GRAFANA_ENDPOINT || 'http://grafana:3000',
      datasource: 'loki'
    }
  }
};

export default stagingLoggingConfig;
