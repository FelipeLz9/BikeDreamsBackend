/** @type {import('jest').Config} */
export default {
  // Environment
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  
  // Module resolution
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'esnext',
        target: 'es2020',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }]
  },
  
  // Test patterns for security tests only
  testMatch: [
    '<rootDir>/src/tests/security/**/*.test.ts',
    '<rootDir>/src/tests/security/**/*.test.js'
  ],
  
  // Coverage configuration for security components
  collectCoverage: true,
  coverageDirectory: 'coverage/security',
  collectCoverageFrom: [
    'src/middleware/securityHeaders.ts',
    'src/middleware/strictSecurity.ts',
    'src/plugins/validationPlugin.ts',
    'src/services/securityLogger.ts',
    'src/services/sanitizer.ts',
    '!src/**/*.d.ts',
    '!src/tests/**/*'
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/middleware/securityHeaders.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/middleware/strictSecurity.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/plugins/validationPlugin.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/security/setup.ts'
  ],
  
  // Test timeouts for security tests (some may take longer)
  testTimeout: 30000,
  
  // Globals for security testing - removed deprecated globals config
  
  // Verbose output for security test results
  verbose: true,
  
  // Error handling
  bail: false,
  maxWorkers: 4,
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Custom reporters for security testing
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'BikeDreams Security Test Report',
      outputPath: 'coverage/security/test-report.html',
      includeFailureMsg: true,
      includeSuiteFailure: true,
      theme: 'darkTheme'
    }],
    ['jest-junit', {
      outputDirectory: 'coverage/security',
      outputName: 'security-junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],
  
  // Cache configuration
  cacheDirectory: '<rootDir>/node_modules/.cache/jest/security',
  
  // Mock configuration for security tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Module directories
  moduleDirectories: [
    'node_modules',
    '<rootDir>/src'
  ],
  
  // Test results processing
  testResultsProcessor: undefined,
  
  // Custom matchers for security testing
  setupFiles: [
    '<rootDir>/src/tests/security/jest.setup.ts'
  ],
  
  // Silent mode for cleaner output during CI
  silent: false,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Node options for security tests
  node: {
    experimental: {
      modules: true
    }
  }
};
