// ==============================================
// BikeDreams Backend - Development Logging Configuration
// ==============================================
// This file contains development-specific logging configurations
// optimized for debugging and development workflows.

export const developmentLoggingConfig = {
  // ==============================================
  // General Configuration
  // ==============================================
  level: 'debug',
  enableConsole: true,
  enableFile: true,
  enableRemote: false,
  
  // ==============================================
  // Console Configuration
  // ==============================================
  console: {
    enabled: true,
    level: 'debug',
    colorize: true,
    timestamp: true,
    format: 'detailed',
    showStack: true,
    showContext: true,
    maxContextDepth: 3
  },
  
  // ==============================================
  // File Configuration
  // ==============================================
  file: {
    enabled: true,
    level: 'debug',
    maxFiles: 5,
    maxSize: '10MB',
    datePattern: 'YYYY-MM-DD',
    compress: true,
    directory: 'logs/development',
    filename: 'app-%DATE%.log',
    errorFilename: 'error-%DATE%.log',
    auditFilename: 'audit-%DATE%.log',
    securityFilename: 'security-%DATE%.log'
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
    debug: 5,
    silly: 6
  },
  
  // ==============================================
  // Development-Specific Features
  // ==============================================
  features: {
    // Enable detailed request logging
    requestLogging: true,
    requestDetails: {
      headers: true,
      body: true,
      query: true,
      params: true,
      response: true,
      timing: true
    },
    
    // Enable database query logging
    databaseLogging: true,
    databaseDetails: {
      queries: true,
      parameters: true,
      timing: true,
      results: true
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
    
    // Enable debugging features
    debugging: {
      stackTrace: true,
      sourceMaps: true,
      breakpoints: true,
      variableInspection: true
    }
  },
  
  // ==============================================
  // Format Configuration
  // ==============================================
  format: {
    timestamp: 'YYYY-MM-DD HH:mm:ss.SSS',
    timezone: 'local',
    json: false,
    prettyPrint: true,
    colorize: true,
    includeLevel: true,
    includeMessage: true,
    includeTimestamp: true,
    includeContext: true
  },
  
  // ==============================================
  // Filter Configuration
  // ==============================================
  filters: {
    // Include all log levels
    includeLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    
    // Include all modules
    includeModules: ['*'],
    
    // Exclude specific patterns
    excludePatterns: [
      'healthcheck',
      'metrics'
    ],
    
    // Include specific patterns
    includePatterns: [
      'auth',
      'database',
      'security',
      'performance'
    ]
  },
  
  // ==============================================
  // Alert Configuration
  // ==============================================
  alerts: {
    enabled: false, // Disabled in development
    channels: [],
    thresholds: {
      errorRate: 0.1, // 10% error rate
      responseTime: 5000, // 5 seconds
      memoryUsage: 0.8, // 80% memory usage
      cpuUsage: 0.8 // 80% CPU usage
    }
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
      includeRedis: true
    },
    
    healthChecks: {
      enabled: true,
      interval: 60000, // 1 minute
      includeDatabase: true,
      includeRedis: true,
      includeExternal: true
    }
  },
  
  // ==============================================
  // Development Tools
  // ==============================================
  tools: {
    // Enable log viewer
    logViewer: {
      enabled: true,
      port: 3002,
      path: '/logs'
    },
    
    // Enable metrics dashboard
    metricsDashboard: {
      enabled: true,
      port: 3003,
      path: '/metrics'
    },
    
    // Enable debug console
    debugConsole: {
      enabled: true,
      port: 3004,
      path: '/debug'
    }
  }
};

export default developmentLoggingConfig;
