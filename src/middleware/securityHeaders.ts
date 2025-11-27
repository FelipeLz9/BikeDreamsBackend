import { Elysia } from 'elysia';
import { SecurityLogger } from '../services/securityLogger';

// Configuración de Content Security Policy
interface CSPConfig {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'connect-src'?: string[];
  'font-src'?: string[];
  'object-src'?: string[];
  'media-src'?: string[];
  'frame-src'?: string[];
  'sandbox'?: string[];
  'report-uri'?: string[];
  'child-src'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'plugin-types'?: string[];
  'base-uri'?: string[];
  'report-to'?: string;
  'worker-src'?: string[];
  'manifest-src'?: string[];
  'prefetch-src'?: string[];
  'navigate-to'?: string[];
}

// Configuración de Permissions Policy (antes Feature Policy)
interface PermissionsPolicyConfig {
  accelerometer?: string[];
  'ambient-light-sensor'?: string[];
  autoplay?: string[];
  battery?: string[];
  camera?: string[];
  'cross-origin-isolated'?: string[];
  'display-capture'?: string[];
  'document-domain'?: string[];
  'encrypted-media'?: string[];
  'execution-while-not-rendered'?: string[];
  'execution-while-out-of-viewport'?: string[];
  fullscreen?: string[];
  geolocation?: string[];
  gyroscope?: string[];
  'keyboard-map'?: string[];
  magnetometer?: string[];
  microphone?: string[];
  midi?: string[];
  'navigation-override'?: string[];
  'payment'?: string[];
  'picture-in-picture'?: string[];
  'publickey-credentials-get'?: string[];
  'screen-wake-lock'?: string[];
  'sync-xhr'?: string[];
  usb?: string[];
  'web-share'?: string[];
  'xr-spatial-tracking'?: string[];
}

// Configuración de CORS avanzado
interface CORSConfig {
  origin?: string[] | string | boolean | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
  varyHeader?: boolean;
}

interface SecurityHeadersConfig {
  // HSTS Configuration
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  
  // CSP Configuration
  contentSecurityPolicy?: CSPConfig | false;
  
  // CORS Configuration
  cors?: CORSConfig;
  
  // Permissions Policy
  permissionsPolicy?: PermissionsPolicyConfig | false;
  
  // Other security headers
  noSniff?: boolean;
  frameguard?: {
    action?: 'deny' | 'sameorigin' | 'allow-from';
    domain?: string;
  };
  xssFilter?: boolean;
  referrerPolicy?: 
    | 'no-referrer' 
    | 'no-referrer-when-downgrade' 
    | 'origin' 
    | 'origin-when-cross-origin' 
    | 'same-origin' 
    | 'strict-origin' 
    | 'strict-origin-when-cross-origin' 
    | 'unsafe-url';
  
  // Cross-Origin headers
  crossOriginEmbedderPolicy?: 'require-corp' | 'unsafe-none';
  crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
  crossOriginResourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
  
  // Additional security headers
  expectCt?: {
    maxAge?: number;
    enforce?: boolean;
    reportUri?: string;
  };
  
  // Development/Production specific
  hideServer?: boolean;
  dnsPrefetchControl?: boolean;
  ieNoOpen?: boolean;
  noCache?: boolean;
}

/**
 * Configuración por defecto para desarrollo
 */
const developmentConfig: SecurityHeadersConfig = {
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: false // En desarrollo no queremos preload
  },
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'localhost:*', '127.0.0.1:*'],
    'style-src': ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
    'font-src': ["'self'", 'fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
    'connect-src': ["'self'", 'localhost:*', '127.0.0.1:*', 'ws:', 'wss:'],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"]
  },
  cors: {
    origin: true, // Permitir todos los orígenes en desarrollo
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400
  },
  permissionsPolicy: {
    camera: ["'none'"],
    microphone: ["'none'"],
    geolocation: ["'self'"],
    payment: ["'none'"],
    usb: ["'none'"],
    'picture-in-picture': ["'none'"]
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginEmbedderPolicy: 'unsafe-none',
  crossOriginOpenerPolicy: 'same-origin-allow-popups',
  crossOriginResourcePolicy: 'cross-origin',
  hideServer: true,
  dnsPrefetchControl: true,
  ieNoOpen: true,
  noCache: false
};

/**
 * Configuración por defecto para producción
 */
const productionConfig: SecurityHeadersConfig = {
  hsts: {
    maxAge: 63072000, // 2 años
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", 'fonts.googleapis.com'],
    'font-src': ["'self'", 'fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'https:'],
    'connect-src': ["'self'", 'https:'],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'report-uri': ['/api/csp-report']
  },
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400,
    optionsSuccessStatus: 204
  },
  permissionsPolicy: {
    camera: ["'none'"],
    microphone: ["'none'"],
    geolocation: ["'self'"],
    payment: ["'none'"],
    usb: ["'none'"],
    midi: ["'none'"],
    'ambient-light-sensor': ["'none'"],
    accelerometer: ["'none'"],
    gyroscope: ["'none'"],
    magnetometer: ["'none'"],
    'picture-in-picture': ["'none'"],
    'screen-wake-lock': ["'none'"],
    'web-share': ["'self'"]
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginEmbedderPolicy: 'require-corp',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
  expectCt: {
    maxAge: 86400,
    enforce: true,
    reportUri: '/api/expect-ct-report'
  },
  hideServer: true,
  dnsPrefetchControl: true,
  ieNoOpen: true,
  noCache: false
};

/**
 * Plugin de headers de seguridad para Elysia
 */
export function securityHeaders(customConfig?: Partial<SecurityHeadersConfig>) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseConfig = isDevelopment ? developmentConfig : productionConfig;
  const config = { ...baseConfig, ...customConfig };

  return new Elysia({ name: 'security-headers' })
    .onRequest((context) => {
      const { set, request } = context;
      const headersToApply: Record<string, string> = {};

      // HSTS (HTTP Strict Transport Security) - Solo en producción
      if (config.hsts && process.env.NODE_ENV === 'production' && request.url.startsWith('https://')) {
        let hstsValue = `max-age=${config.hsts.maxAge || 31536000}`;
        if (config.hsts.includeSubDomains) hstsValue += '; includeSubDomains';
        if (config.hsts.preload) hstsValue += '; preload';
        headersToApply['Strict-Transport-Security'] = hstsValue;
      }

      // Content Security Policy
      if (config.contentSecurityPolicy) {
        const cspDirectives = Object.entries(config.contentSecurityPolicy)
          .map(([key, values]) => {
            if (Array.isArray(values)) {
              return `${key} ${values.join(' ')}`;
            }
            return `${key} ${values}`;
          })
          .join('; ');
        headersToApply['Content-Security-Policy'] = cspDirectives;
      }

      // X-Content-Type-Options
      if (config.noSniff) {
        headersToApply['X-Content-Type-Options'] = 'nosniff';
      }

      // X-Frame-Options
      if (config.frameguard) {
        let frameValue = config.frameguard.action || 'sameorigin';
        if (frameValue === 'allow-from' && config.frameguard.domain) {
          frameValue += ` ${config.frameguard.domain}`;
        }
        headersToApply['X-Frame-Options'] = frameValue.toUpperCase();
      }

      // X-XSS-Protection
      if (config.xssFilter) {
        headersToApply['X-XSS-Protection'] = '1; mode=block';
      }

      // Referrer Policy
      if (config.referrerPolicy) {
        headersToApply['Referrer-Policy'] = config.referrerPolicy;
      }

      // Cross-Origin-Embedder-Policy
      if (config.crossOriginEmbedderPolicy) {
        headersToApply['Cross-Origin-Embedder-Policy'] = config.crossOriginEmbedderPolicy as string;
      }

      // Cross-Origin-Opener-Policy
      if (config.crossOriginOpenerPolicy) {
        headersToApply['Cross-Origin-Opener-Policy'] = config.crossOriginOpenerPolicy as string;
      }

      // Cross-Origin-Resource-Policy
      if (config.crossOriginResourcePolicy) {
        headersToApply['Cross-Origin-Resource-Policy'] = config.crossOriginResourcePolicy as string;
      }

      // Permissions Policy (antes Feature Policy)
      if (config.permissionsPolicy) {
        const permissionsDirectives = Object.entries(config.permissionsPolicy)
          .map(([key, values]) => {
            if (Array.isArray(values)) {
              return `${key}=(${values.join(' ')})`;
            }
            return `${key}=(${values})`;
          })
          .join(', ');
        headersToApply['Permissions-Policy'] = permissionsDirectives;
      }

      // Expect-CT - Solo en producción
      if (config.expectCt && process.env.NODE_ENV === 'production' && request.url.startsWith('https://')) {
        let expectCtValue = `max-age=${config.expectCt.maxAge || 86400}`;
        if (config.expectCt.enforce) expectCtValue += ', enforce';
        if (config.expectCt.reportUri) expectCtValue += `, report-uri="${config.expectCt.reportUri}"`;
        headersToApply['Expect-CT'] = expectCtValue;
      }

      // Hide server information
      if (config.hideServer) {
        headersToApply['Server'] = 'BikeDreams';
        // Can't delete request headers; ensure we don't set X-Powered-By
      }

      // DNS Prefetch Control
      if (config.dnsPrefetchControl) {
        headersToApply['X-DNS-Prefetch-Control'] = 'off';
      }

      // IE No Open
      if (config.ieNoOpen) {
        headersToApply['X-Download-Options'] = 'noopen';
      }

      // No Cache (for sensitive endpoints)
      if (config.noCache) {
        headersToApply['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
        headersToApply['Pragma'] = 'no-cache';
        headersToApply['Expires'] = '0';
        headersToApply['Surrogate-Control'] = 'no-store';
      }

      // Security headers adicionales
      headersToApply['X-Permitted-Cross-Domain-Policies'] = 'none';
      headersToApply['Clear-Site-Data'] = '"cache", "cookies", "storage"';

      // Log security headers application
      SecurityLogger.logSecurityEvent({
        type: 'system_breach',
        severity: 'low',
        details: {
          action: 'security_headers_applied',
          url: request.url,
          userAgent: request.headers.get('user-agent'),
          headersApplied: Object.keys(headersToApply)
        }
      });

      // Merge into Elysia's response headers
      set.headers = { ...(set.headers || {}), ...headersToApply } as any;
      return undefined;
    });
}

/**
 * Plugin específico para CORS avanzado
 */
export function advancedCORS(config?: CORSConfig) {
  const corsConfig = config || (process.env.NODE_ENV === 'development' 
    ? developmentConfig.cors! 
    : productionConfig.cors!);

  return new Elysia({ name: 'advanced-cors' })
    .derive(() => {
      return {
        cors: corsConfig
      };
    })
    .onBeforeHandle((context) => {
      const origin = context.request.headers.get('origin');
      const method = context.request.method;
      
      // Handle preflight requests
      if (method === 'OPTIONS') {
        const headers = new Headers();
        
        // Simple CORS for now
        if (process.env.NODE_ENV === 'development') {
          headers.set('Access-Control-Allow-Origin', origin || '*');
        } else {
          headers.set('Access-Control-Allow-Origin', 'https://bikedreams.com');
        }
        
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Forwarded-For');
        headers.set('Access-Control-Max-Age', '86400');
        headers.set('Vary', 'Origin');

        return new Response(null, {
          status: 204,
          headers
        });
      }

      return undefined; // Continue with normal processing
    });
}

/**
 * Plugin para reportes CSP y Expect-CT
 */
export function securityReports() {
  return new Elysia({ name: 'security-reports' })
    .post('/api/csp-report', async (context) => {
      try {
        const report = await context.request.json();
        
        SecurityLogger.logAttackAttempt({
          type: 'attack_attempt',
          attackType: 'xss',
          severity: 'medium',
          ip: context.request.headers.get('x-forwarded-for') || 
              context.request.headers.get('x-real-ip') || 
              'unknown',
          userAgent: context.request.headers.get('user-agent') || undefined,
          blocked: true,
          source: 'headers',
          details: {
            type: 'csp_violation',
            report,
            timestamp: new Date().toISOString()
          }
        });

        return new Response(null, { status: 204 });
      } catch (error) {
        return new Response('Invalid report', { status: 400 });
      }
    })
    .post('/api/expect-ct-report', async (context) => {
      try {
        const report = await context.request.json();
        
        SecurityLogger.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'medium',
          ip: context.request.headers.get('x-forwarded-for') || 
              context.request.headers.get('x-real-ip') || 
              'unknown',
          details: {
            type: 'expect_ct_violation',
            report,
            timestamp: new Date().toISOString()
          }
        });

        return new Response(null, { status: 204 });
      } catch (error) {
        return new Response('Invalid report', { status: 400 });
      }
    });
}

/**
 * Plugin combinado de todos los headers de seguridad
 */
export function fullSecurityHeaders(config?: Partial<SecurityHeadersConfig>) {
  // Usar configuración por defecto según el entorno si no se proporciona configuración personalizada
  const defaultConfig = process.env.NODE_ENV === 'development' 
    ? developmentConfig 
    : productionConfig;
  
  const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
  
  return new Elysia({ name: 'full-security-headers' })
    .use(securityHeaders(finalConfig))
    .use(advancedCORS(finalConfig?.cors))
    .use(securityReports());
}

// Exportar configuraciones por defecto
export { developmentConfig, productionConfig };
export type { SecurityHeadersConfig, CORSConfig, CSPConfig, PermissionsPolicyConfig };
