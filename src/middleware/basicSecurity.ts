import { Elysia } from 'elysia';

/**
 * Configuración de seguridad básica para desarrollo
 */
export function basicSecurityMiddleware() {
  return new Elysia({ name: 'basic-security' })
    .onRequest((context) => {
      const { set } = context;
      
      // Headers básicos de seguridad para desarrollo
      set.headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
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

/**
 * Middleware de CORS básico para desarrollo
 */
export function basicCorsMiddleware() {
  return new Elysia({ name: 'basic-cors' })
    .onBeforeHandle((context) => {
      const { request, set } = context;
      
      // Manejar preflight requests
      if (request.method === 'OPTIONS') {
        set.headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400'
        };
        return new Response(null, { status: 204 });
      }
    });
}
