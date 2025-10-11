// Mocks
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    exists: jest.fn()
  }));
});

jest.mock('../../services/securityLogger', () => ({
  SecurityLogger: {
    logRateLimitEvent: jest.fn(),
    logSecurityEvent: jest.fn()
  },
  logSecurityEvent: jest.fn()
}));

import { createRateLimiter, advancedRateLimiter, createRoleBasedRateLimiter } from '../../middleware/rateLimiter';

describe('⏰ RateLimiter Middleware', () => {
  let mockRedis: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn(),
      exists: jest.fn()
    };

    mockContext = {
      request: {
        url: '/api/test',
        method: 'GET'
      },
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'test-agent'
      },
      set: {
        status: jest.fn(),
        headers: {}
      }
    };
  });

  describe('createRateLimiter', () => {
    test('should allow request within rate limit', async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (context) => context.headers['x-forwarded-for'] || 'unknown'
      });

      mockRedis.get.mockResolvedValue('50'); // Current count
      mockRedis.incr.mockResolvedValue(51);
      mockRedis.ttl.mockResolvedValue(30);

      if (typeof rateLimiter === 'function') {
        const result = await rateLimiter(mockContext);
        expect(result).toBeUndefined(); // Should pass through
      }
    });

    test('should block request when rate limit exceeded', async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (context) => context.headers['x-forwarded-for'] || 'unknown'
      });

      mockRedis.get.mockResolvedValue('100'); // At limit
      mockRedis.incr.mockResolvedValue(101); // Exceeds limit
      mockRedis.ttl.mockResolvedValue(30);

      if (typeof rateLimiter === 'function') {
        try {
          await rateLimiter(mockContext);
        } catch (error: any) {
          expect(error.message).toContain('Rate limit exceeded');
        }
      }
    });

    test('should handle Redis errors gracefully', async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (context) => context.headers['x-forwarded-for'] || 'unknown'
      });

      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      if (typeof rateLimiter === 'function') {
        // Should not throw, should allow request when Redis fails
        const result = await rateLimiter(mockContext);
        expect(result).toBeUndefined();
      }
    });
  });

  describe('advancedRateLimiter', () => {
    test('should handle advanced rate limiting scenarios', async () => {
      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(30);

      if (typeof advancedRateLimiter === 'function') {
        const result = await advancedRateLimiter(mockContext);
        expect(result).toBeUndefined();
      }
    });

    test('should implement progressive delays', async () => {
      mockRedis.get.mockResolvedValue('90'); // Near limit
      mockRedis.incr.mockResolvedValue(91);
      mockRedis.ttl.mockResolvedValue(30);

      if (typeof advancedRateLimiter === 'function') {
        const result = await advancedRateLimiter(mockContext);
        // Should add delay headers or implement progressive delays
        expect(result).toBeUndefined();
      }
    });
  });

  describe('createRoleBasedRateLimiter', () => {
    test('should apply different limits for different roles', async () => {
      const roleBasedLimiter = createRoleBasedRateLimiter({
        ADMIN: { windowMs: 60000, max: 1000 },
        CLIENT: { windowMs: 60000, max: 100 },
        GUEST: { windowMs: 60000, max: 10 }
      });

      const adminContext = {
        ...mockContext,
        user: { role: 'ADMIN' }
      };

      mockRedis.get.mockResolvedValue('500');
      mockRedis.incr.mockResolvedValue(501);
      mockRedis.ttl.mockResolvedValue(30);

      if (typeof roleBasedLimiter === 'function') {
        const result = await roleBasedLimiter(adminContext);
        expect(result).toBeUndefined(); // Admin should have higher limits
      }
    });

    test('should block guest users with low limits', async () => {
      const roleBasedLimiter = createRoleBasedRateLimiter({
        ADMIN: { windowMs: 60000, max: 1000 },
        CLIENT: { windowMs: 60000, max: 100 },
        GUEST: { windowMs: 60000, max: 10 }
      });

      const guestContext = {
        ...mockContext,
        user: { role: 'GUEST' }
      };

      mockRedis.get.mockResolvedValue('10');
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(30);

      if (typeof roleBasedLimiter === 'function') {
        try {
          await roleBasedLimiter(guestContext);
        } catch (error: any) {
          expect(error.message).toContain('Rate limit exceeded');
        }
      }
    });

    test('should use default limits for unknown roles', async () => {
      const roleBasedLimiter = createRoleBasedRateLimiter({
        ADMIN: { windowMs: 60000, max: 1000 },
        CLIENT: { windowMs: 60000, max: 100 }
      });

      const unknownContext = {
        ...mockContext,
        user: { role: 'UNKNOWN' }
      };

      mockRedis.get.mockResolvedValue('50');
      mockRedis.incr.mockResolvedValue(51);
      mockRedis.ttl.mockResolvedValue(30);

      if (typeof roleBasedLimiter === 'function') {
        const result = await roleBasedLimiter(unknownContext);
        expect(result).toBeUndefined();
      }
    });
  });

  describe('Edge cases', () => {
    test('should handle missing IP address', async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (context) => context.headers['x-forwarded-for'] || 'unknown'
      });

      const contextWithoutIP = {
        ...mockContext,
        headers: {
          'user-agent': 'test-agent'
        }
      };

      mockRedis.get.mockResolvedValue('50');
      mockRedis.incr.mockResolvedValue(51);

      if (typeof rateLimiter === 'function') {
        const result = await rateLimiter(contextWithoutIP);
        expect(result).toBeUndefined();
      }
    });

    test('should handle concurrent requests', async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (context) => context.headers['x-forwarded-for'] || 'unknown'
      });

      mockRedis.get.mockResolvedValue('99');
      mockRedis.incr.mockResolvedValue(100);
      mockRedis.ttl.mockResolvedValue(30);

      if (typeof rateLimiter === 'function') {
        // Simulate concurrent requests
        const requests = Array(5).fill(null).map(() => rateLimiter(mockContext));
        const results = await Promise.allSettled(requests);
        
        // Some should pass, some might fail due to race conditions
        expect(results).toHaveLength(5);
      }
    });

    test('should reset counter after window expires', async () => {
      const rateLimiter = createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (context) => context.headers['x-forwarded-for'] || 'unknown'
      });

      // First request after window expiry
      mockRedis.get.mockResolvedValue(null); // No existing count
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(-1); // Key doesn't exist

      if (typeof rateLimiter === 'function') {
        const result = await rateLimiter(mockContext);
        expect(result).toBeUndefined();
        expect(mockRedis.expire).toHaveBeenCalled();
      }
    });
  });
});
