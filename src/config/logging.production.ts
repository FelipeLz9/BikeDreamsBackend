// ==============================================
// BikeDreams Backend - Production Logging Configuration
// ==============================================
// This file contains production-specific logging configurations
// optimized for performance, security, and monitoring.

export const productionLoggingConfig = {
  // ==============================================
  // General Configuration
  // ==============================================
  level: 'warn',
  enableConsole: false,
  enableFile: true,
  enableRemote: true,
  
  // ==============================================
  // Console Configuration
  // ==============================================
  console: {
    enabled: false,
    level: 'error',
    colorize: false,
    timestamp: true,
    format: 'json',
    showStack: false,
    showContext: false,
    maxContextDepth: 1
  },
  
  // ==============================================
  // File Configuration
  // ==============================================
  file: {
    enabled: true,
    level: 'warn',
    maxFiles: 30,
    maxSize: '100MB',
    datePattern: 'YYYY-MM-DD',
    compress: true,
    directory: 'logs/production',
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
    level: 'warn',
    labels: {
      environment: 'production',
      service: 'bikedreams-backend',
      version: process.env.APP_VERSION || '1.0.0',
      region: process.env.AWS_REGION || 'us-east-1',
      instance: process.env.INSTANCE_ID || 'unknown'
    },
    batchSize: 500,
    batchTimeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  
  // ==============================================
  // Log Levels Configuration
  // ==============================================
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3
  },
  
  // ==============================================
  // Production-Specific Features
  // ==============================================
  features: {
    // Enable minimal request logging
    requestLogging: true,
    requestDetails: {
      headers: false,
      body: false,
      query: false,
      params: false,
      response: false,
      timing: true
    },
    
    // Enable minimal database query logging
    databaseLogging: false,
    databaseDetails: {
      queries: false,
      parameters: false,
      timing: false,
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
    
    // Enable audit logging
    auditLogging: true,
    auditDetails: {
      userActions: true,
      dataChanges: true,
      systemEvents: true,
      compliance: true
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
    includeContext: false
  },
  
  // ==============================================
  // Filter Configuration
  // ==============================================
  filters: {
    // Include only critical log levels
    includeLevels: ['error', 'warn'],
    
    // Include all modules
    includeModules: ['*'],
    
    // Exclude specific patterns
    excludePatterns: [
      'healthcheck',
      'metrics',
      'debug',
      'verbose',
      'info'
    ],
    
    // Include specific patterns
    includePatterns: [
      'auth',
      'security',
      'performance',
      'api',
      'business',
      'audit'
    ]
  },
  
  // ==============================================
  // Alert Configuration
  // ==============================================
  alerts: {
    enabled: true,
    channels: ['email', 'slack', 'webhook', 'pagerduty'],
    thresholds: {
      errorRate: 0.01, // 1% error rate
      responseTime: 2000, // 2 seconds
      memoryUsage: 0.8, // 80% memory usage
      cpuUsage: 0.8, // 80% CPU usage
      securityEvents: 5 // 5 security events per minute
    },
    
    // Alert rules
    rules: [
      {
        name: 'Critical Error Rate',
        condition: 'errorRate > 0.01',
        severity: 'critical',
        cooldown: 300000 // 5 minutes
      },
      {
        name: 'High Response Time',
        condition: 'responseTime > 2000',
        severity: 'warning',
        cooldown: 600000 // 10 minutes
      },
      {
        name: 'Critical Memory Usage',
        condition: 'memoryUsage > 0.8',
        severity: 'critical',
        cooldown: 300000 // 5 minutes
      },
      {
        name: 'Critical CPU Usage',
        condition: 'cpuUsage > 0.8',
        severity: 'critical',
        cooldown: 300000 // 5 minutes
      },
      {
        name: 'Security Event Spike',
        condition: 'securityEvents > 5',
        severity: 'critical',
        cooldown: 60000 // 1 minute
      },
      {
        name: 'Service Down',
        condition: 'healthCheck == false',
        severity: 'critical',
        cooldown: 30000 // 30 seconds
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
      interval: 60000, // 1 minute
      includeSystem: true,
      includeApplication: true,
      includeDatabase: true,
      includeRedis: true,
      includeExternal: true,
      includeBusiness: true
    },
    
    healthChecks: {
      enabled: true,
      interval: 30000, // 30 seconds
      includeDatabase: true,
      includeRedis: true,
      includeExternal: true,
      includeDependencies: true,
      includeBusiness: true
    },
    
    // Prometheus metrics
    prometheus: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      collectDefaultMetrics: true,
      customMetrics: true,
      authentication: true
    }
  },
  
  // ==============================================
  // Production Tools
  // ==============================================
  tools: {
    // Disable log viewer in production
    logViewer: {
      enabled: false
    },
    
    // Enable metrics dashboard
    metricsDashboard: {
      enabled: true,
      port: 3003,
      path: '/metrics',
      authentication: true,
      ssl: true
    },
    
    // Enable Grafana integration
    grafana: {
      enabled: true,
      endpoint: process.env.GRAFANA_ENDPOINT || 'https://grafana.bikedreams.com',
      datasource: 'loki',
      authentication: true
    }
  },
  
  // ==============================================
  // Security Configuration
  // ==============================================
  security: {
    // Sanitize sensitive data
    sanitize: {
      enabled: true,
      patterns: [
        'password',
        'token',
        'secret',
        'key',
        'credit',
        'ssn',
        'email'
      ]
    },
    
    // Encrypt sensitive logs
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      key: process.env.LOG_ENCRYPTION_KEY
    },
    
    // Audit trail
    audit: {
      enabled: true,
      retention: 2555, // 7 years in days
      compliance: true
    }
  }
};

export default productionLoggingConfig;
