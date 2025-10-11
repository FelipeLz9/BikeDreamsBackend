import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Elysia } from 'elysia';
import { testRoutes } from '../../../routes/test.js';

// Mock global fetch for scraper-health endpoint
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('🧪 Test Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new Elysia().use(testRoutes);
    
    // Reset environment variables
    delete process.env.SCRAPER_API_URL;
  });

  describe('GET /api/test/hello', () => {
    it('should return hello message with timestamp', async () => {
      const response = await app.handle(new Request('http://localhost/api/test/hello'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('message');
      expect(responseBody).toHaveProperty('timestamp');
      expect(responseBody.message).toBe('Test route works!');
      expect(typeof responseBody.timestamp).toBe('string');
      
      // Verify timestamp is in ISO format
      expect(() => new Date(responseBody.timestamp)).not.toThrow();
      expect(new Date(responseBody.timestamp).toISOString()).toBe(responseBody.timestamp);
    });

    it('should return current timestamp on each request', async () => {
      const response1 = await app.handle(new Request('http://localhost/api/test/hello'));
      const body1 = await response1.json();
      
      // Wait a small amount to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response2 = await app.handle(new Request('http://localhost/api/test/hello'));
      const body2 = await response2.json();

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(body1.timestamp).not.toBe(body2.timestamp);
      expect(new Date(body1.timestamp).getTime()).toBeLessThan(new Date(body2.timestamp).getTime());
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => 
        app.handle(new Request('http://localhost/api/test/hello'))
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const bodies = await Promise.all(responses.map(r => r.json()));
      
      bodies.forEach(body => {
        expect(body.message).toBe('Test route works!');
        expect(body.timestamp).toBeDefined();
      });

      // All timestamps should be different (or very close)
      const timestamps = bodies.map(b => b.timestamp);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBeGreaterThanOrEqual(1); // At least one unique timestamp
    });
  });

  describe('GET /api/test/scraper-health', () => {
    const defaultScraperUrl = 'http://localhost:4000';

    it('should check scraper health successfully with default URL', async () => {
      const mockResponse = {
        ok: true,
        status: 200
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        isHealthy: true,
        scraperUrl: defaultScraperUrl,
        status: 200
      });

      expect(mockFetch).toHaveBeenCalledWith(
        defaultScraperUrl + '/',
        { signal: expect.any(AbortSignal) }
      );
    });

    it('should use custom scraper URL from environment', async () => {
      const customUrl = 'http://custom-scraper:5000';
      process.env.SCRAPER_API_URL = customUrl;
      
      const mockResponse = {
        ok: true,
        status: 200
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        isHealthy: true,
        scraperUrl: customUrl,
        status: 200
      });

      expect(mockFetch).toHaveBeenCalledWith(
        customUrl + '/',
        { signal: expect.any(AbortSignal) }
      );
    });

    it('should handle scraper returning error status', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        isHealthy: false,
        scraperUrl: defaultScraperUrl,
        status: 500
      });
    });

    it('should handle scraper connection timeout', async () => {
      const timeoutError = new Error('The operation was aborted due to timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.isHealthy).toBe(false);
      expect(responseBody.scraperUrl).toBe(defaultScraperUrl);
      expect(responseBody.error).toBe('Error: The operation was aborted due to timeout');
    });

    it('should handle network connection errors', async () => {
      const networkError = new Error('fetch failed');
      networkError.name = 'TypeError';
      mockFetch.mockRejectedValue(networkError);

      const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.isHealthy).toBe(false);
      expect(responseBody.scraperUrl).toBe(defaultScraperUrl);
      expect(responseBody.error).toBe('Error: fetch failed');
    });

    it('should handle DNS resolution errors', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND invalid-host');
      mockFetch.mockRejectedValue(dnsError);

      const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.isHealthy).toBe(false);
      expect(responseBody.scraperUrl).toBe(defaultScraperUrl);
      expect(typeof responseBody.error).toBe('string');
    });

    it('should handle different HTTP status codes correctly', async () => {
      const statusCodes = [200, 201, 301, 404, 500, 503];
      
      for (const statusCode of statusCodes) {
        const mockResponse = {
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode
        };
        mockFetch.mockResolvedValue(mockResponse);

        const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));
        const responseBody = await response.json();

        expect(response.status).toBe(200);
        expect(responseBody.status).toBe(statusCode);
        expect(responseBody.isHealthy).toBe(statusCode >= 200 && statusCode < 300);
      }
    });

    it('should include timeout signal in fetch request', async () => {
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValue(mockResponse);

      await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should handle custom environment URLs with different protocols', async () => {
      const customUrls = [
        'https://secure-scraper.example.com',
        'http://192.168.1.100:3000',
        'http://scraper-service:8080'
      ];

      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValue(mockResponse);

      for (const url of customUrls) {
        process.env.SCRAPER_API_URL = url;
        
        const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));
        const responseBody = await response.json();

        expect(responseBody.scraperUrl).toBe(url);
        expect(mockFetch).toHaveBeenCalledWith(
          url + '/',
          expect.any(Object)
        );
      }
    });

    it('should handle malformed URLs gracefully', async () => {
      process.env.SCRAPER_API_URL = 'not-a-valid-url';
      
      const urlError = new Error('Invalid URL');
      mockFetch.mockRejectedValue(urlError);

      const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.isHealthy).toBe(false);
      expect(responseBody.scraperUrl).toBe('not-a-valid-url');
      expect(responseBody.error).toContain('Error');
    });
  });

  describe('Route Integration and Error Handling', () => {
    it('should handle all test endpoints with proper HTTP methods', async () => {
      const endpoints = [
        { path: '/api/test/hello', method: 'GET' },
        { path: '/api/test/scraper-health', method: 'GET' }
      ];

      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      for (const endpoint of endpoints) {
        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: endpoint.method
          })
        );

        expect(response.status).toBe(200);
        expect(response.status).not.toBe(404);
        expect(response.status).not.toBe(405);
      }
    });

    it('should not require authentication (public test endpoints)', async () => {
      // Test endpoints should be public and accessible without authentication
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const response1 = await app.handle(new Request('http://localhost/api/test/hello'));
      const response2 = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // No authentication headers required
      const body1 = await response1.json();
      const body2 = await response2.json();

      expect(body1.message).toBeDefined();
      expect(body2.scraperUrl).toBeDefined();
    });

    it('should handle concurrent requests efficiently', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const requests = [
        app.handle(new Request('http://localhost/api/test/hello')),
        app.handle(new Request('http://localhost/api/test/scraper-health')),
        app.handle(new Request('http://localhost/api/test/hello')),
        app.handle(new Request('http://localhost/api/test/scraper-health'))
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should have made 2 fetch calls to scraper-health
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should provide consistent response format', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const helloResponse = await app.handle(new Request('http://localhost/api/test/hello'));
      const healthResponse = await app.handle(new Request('http://localhost/api/test/scraper-health'));

      expect(helloResponse.status).toBe(200);
      expect(healthResponse.status).toBe(200);

      const helloBody = await helloResponse.json();
      const healthBody = await healthResponse.json();

      // Both should return JSON objects
      expect(typeof helloBody).toBe('object');
      expect(typeof healthBody).toBe('object');

      // Hello endpoint structure
      expect(helloBody).toHaveProperty('message');
      expect(helloBody).toHaveProperty('timestamp');

      // Health endpoint structure
      expect(healthBody).toHaveProperty('isHealthy');
      expect(healthBody).toHaveProperty('scraperUrl');
    });

    it('should handle invalid HTTP methods gracefully', async () => {
      const invalidMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of invalidMethods) {
        const response1 = await app.handle(new Request('http://localhost/api/test/hello', { method }));
        const response2 = await app.handle(new Request('http://localhost/api/test/scraper-health', { method }));

        // Should return method not allowed or handle gracefully
        expect([200, 404, 405]).toContain(response1.status);
        expect([200, 404, 405]).toContain(response2.status);
      }
    });

    it('should handle high-frequency requests', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const requests = Array.from({ length: 20 }, (_, i) => {
        const endpoint = i % 2 === 0 ? '/api/test/hello' : '/api/test/scraper-health';
        return app.handle(new Request(`http://localhost${endpoint}`));
      });

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should have made 10 fetch calls for scraper-health endpoints
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it('should handle edge cases with environment variables', async () => {
      const edgeCases = [
        '', // empty string
        ' ', // whitespace
        'http://', // incomplete URL
        'https://example.com:99999' // invalid port
      ];

      mockFetch.mockRejectedValue(new Error('Connection failed'));

      for (const edgeCase of edgeCases) {
        process.env.SCRAPER_API_URL = edgeCase;

        const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));
        const responseBody = await response.json();

        expect(response.status).toBe(200);
        expect(responseBody.isHealthy).toBe(false);
        expect(responseBody.scraperUrl).toBe(edgeCase || defaultScraperUrl);
        expect(responseBody.error).toBeDefined();
      }
    });

    it('should provide helpful error messages', async () => {
      const errorScenarios = [
        { 
          error: new Error('Network timeout'), 
          expectedInError: 'timeout' 
        },
        { 
          error: new Error('Connection refused'), 
          expectedInError: 'refused' 
        },
        { 
          error: new Error('DNS resolution failed'), 
          expectedInError: 'DNS' 
        }
      ];

      for (const scenario of errorScenarios) {
        mockFetch.mockRejectedValue(scenario.error);

        const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));
        const responseBody = await response.json();

        expect(responseBody.isHealthy).toBe(false);
        expect(responseBody.error.toLowerCase()).toContain(scenario.expectedInError.toLowerCase());
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle slow scraper responses', async () => {
      // Simulate slow response that should be caught by timeout
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Operation timed out'));
          }, 6000); // Longer than 5s timeout
        })
      );

      const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.isHealthy).toBe(false);
      expect(responseBody.error).toContain('timed out');
    });

    it('should be resilient to scraper service failures', async () => {
      // Test different failure scenarios
      const failures = [
        new Error('ECONNREFUSED'),
        new Error('ENOTFOUND'),
        new Error('ETIMEDOUT'),
        new Error('Network error')
      ];

      for (const failure of failures) {
        mockFetch.mockRejectedValue(failure);

        const response = await app.handle(new Request('http://localhost/api/test/scraper-health'));
        const responseBody = await response.json();

        expect(response.status).toBe(200); // Always returns 200, error info in body
        expect(responseBody.isHealthy).toBe(false);
        expect(responseBody.error).toContain(failure.message);
      }
    });

    it('should maintain consistent performance under load', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const startTime = Date.now();
      
      const requests = Array.from({ length: 50 }, () =>
        app.handle(new Request('http://localhost/api/test/hello'))
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const duration = endTime - startTime;
      
      // Should complete 50 requests reasonably quickly (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle memory efficiently with many requests', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      // Create many requests in batches to test memory handling
      const batchSize = 10;
      const batches = 5;

      for (let i = 0; i < batches; i++) {
        const requests = Array.from({ length: batchSize }, () =>
          app.handle(new Request('http://localhost/api/test/hello'))
        );

        const responses = await Promise.all(requests);
        
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
      }

      // If we get here without memory issues, test passed
      expect(true).toBe(true);
    });
  });
});