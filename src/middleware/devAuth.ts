import { Elysia } from 'elysia';

/**
 * Middleware de autenticación simplificado para desarrollo
 */
export function devAuthMiddleware() {
  return new Elysia({ name: 'dev-auth' })
    .onRequest((context) => {
      const { set } = context;
      
      // Headers básicos de seguridad para desarrollo
      const origin = context.request.headers.get('origin');
      const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
      const allowedOrigin = allowedOrigins.includes(origin || '') ? origin : 'http://localhost:3000';
      
      
      set.headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Server': 'BikeDreams-Dev'
      };
    });
}
