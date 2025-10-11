import { Elysia } from 'elysia';

export const testRoutes = new Elysia({ prefix: '/api/test' })
  .get('/hello', () => ({
    message: 'Test route works!',
    timestamp: new Date().toISOString()
  }))
  .get('/scraper-health', async () => {
    try {
      const SCRAPER_API_URL = process.env.SCRAPER_API_URL || 'http://localhost:4000';
      const response = await fetch(`${SCRAPER_API_URL}/`, { signal: AbortSignal.timeout(5000) });
      return {
        isHealthy: response.ok,
        scraperUrl: SCRAPER_API_URL,
        status: response.status
      };
    } catch (error) {
      return {
        isHealthy: false,
        scraperUrl: process.env.SCRAPER_API_URL || 'http://localhost:4000',
        error: String(error)
      };
    }
  });
