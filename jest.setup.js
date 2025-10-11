// Jest setup file for global test configuration

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/bikedreams_test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';

// Mock external dependencies that shouldn't run in tests
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Mock logger to avoid console spam in tests
jest.mock('./src/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

// Global test timeout
jest.setTimeout(30000);

// Mock Date.now for consistent testing
const originalDateNow = Date.now;
let mockDateNow;

beforeAll(() => {
  // You can set a fixed timestamp for testing
  // mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // Jan 1, 2022
});

afterAll(() => {
  if (mockDateNow) {
    mockDateNow.mockRestore();
  }
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Custom matchers for better assertions
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false
      };
    }
  },
  
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false
      };
    }
  },
  
  toHaveValidSecurityHeaders(received) {
    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security'
    ];
    
    const missingHeaders = requiredHeaders.filter(
      header => !received.headers || !received.headers[header]
    );
    
    if (missingHeaders.length === 0) {
      return {
        message: () => `expected response not to have all security headers`,
        pass: true
      };
    } else {
      return {
        message: () => `expected response to have security headers: ${missingHeaders.join(', ')}`,
        pass: false
      };
    }
  }
});

// Add TypeScript types for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJWT(): R;
      toBeValidEmail(): R;
      toHaveValidSecurityHeaders(): R;
    }
  }
}
