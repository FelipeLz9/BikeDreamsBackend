import { Elysia } from 'elysia';
import { SecurityLogger } from '../services/securityLogger';
import { securityHeaders, type SecurityHeadersConfig } from './securityHeaders.js';

/**
 * Configuración de seguridad estricta para endpoints sensibles
 */
const strictSecurityConfig: SecurityHeadersConfig = {
  hsts: {
    maxAge: 63072000, // 2 años
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    'default-src': ["'none'"],
    'script-src': ["'none'"],
    'style-src': ["'none'"],
    'img-src': ["'none'"],
    'connect-src': ["'self'"],
    'font-src': ["'none'"],
    'object-src': ["'none'"],
    'media-src': ["'none'"],
    'frame-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'frame-ancestors': ["'none'"],
    'report-uri': ['/api/csp-report']
  },
  cors: {
    origin: false, // No CORS para endpoints sensibles
    credentials: false
  },
  permissionsPolicy: {
    camera: ["'none'"],
    microphone: ["'none'"],
    geolocation: ["'none'"],
    payment: ["'none'"],
    usb: ["'none'"],
    midi: ["'none'"],
    'ambient-light-sensor': ["'none'"],
    accelerometer: ["'none'"],
    gyroscope: ["'none'"],
    magnetometer: ["'none'"],
    'picture-in-picture': ["'none'"],
    'screen-wake-lock': ["'none'"],
    'web-share': ["'none'"],
    autoplay: ["'none'"],
    'encrypted-media': ["'none'"],
    fullscreen: ["'none'"]
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: 'no-referrer',
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
  noCache: true // Siempre no-cache para endpoints sensibles
};

/**
 * Configuración de seguridad para endpoints de administración
 */
const adminSecurityConfig: SecurityHeadersConfig = {
  ...strictSecurityConfig,
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'nonce-admin'"],
    'style-src': ["'self'", "'nonce-admin'"],
    'img-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'media-src': ["'none'"],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'report-uri': ['/api/csp-report']
  },
  cors: {
    origin: process.env.ADMIN_ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token'],
    maxAge: 300 // Solo 5 minutos de cache para admin
  }
};

/**
 * Middleware de seguridad estricta para endpoints sensibles
 */
export function strictSecurityMiddleware() {
  return new Elysia({ name: 'strict-security' })
    .use(securityHeaders(strictSecurityConfig))
    .onRequest((context) => {
      // Log de acceso a endpoint sensible
      SecurityLogger.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'medium',
        ip: getClientIP(context),
        userAgent: context.request.headers.get('user-agent') || undefined,
        endpoint: new URL(context.request.url).pathname,
        method: context.request.method,
        details: {
          type: 'sensitive_endpoint_access',
          timestamp: new Date().toISOString(),
          referer: context.request.headers.get('referer'),
          acceptLanguage: context.request.headers.get('accept-language')
        }
      });
    });
}

/**
 * Middleware de seguridad para endpoints de administración
 */
export function adminSecurityMiddleware() {
  return new Elysia({ name: 'admin-security' })
    .use(securityHeaders(adminSecurityConfig))
    .onRequest((context) => {
      const clientIP = getClientIP(context);
      const userAgent = context.request.headers.get('user-agent') || undefined;
      
      // Validar si la IP está en la lista de IPs permitidas para admin
      const allowedAdminIPs = process.env.ADMIN_ALLOWED_IPS?.split(',') || [];
      if (allowedAdminIPs.length > 0 && !allowedAdminIPs.includes(clientIP)) {
        SecurityLogger.logAttackAttempt({
          type: 'attack_attempt',
          attackType: 'brute_force',
          severity: 'high',
          ip: clientIP,
          userAgent,
          endpoint: new URL(context.request.url).pathname,
          method: context.request.method,
          blocked: true,
          source: 'headers',
          details: {
            type: 'unauthorized_admin_access',
            allowedIPs: allowedAdminIPs,
            timestamp: new Date().toISOString()
          }
        });
        
        return new Response('Forbidden', { status: 403 });
      }

      // Log de acceso administrativo
      SecurityLogger.logSecurityEvent({
        type: 'authorization',
        severity: 'medium',
        ip: clientIP,
        userAgent,
        endpoint: new URL(context.request.url).pathname,
        method: context.request.method,
        details: {
          type: 'admin_endpoint_access',
          timestamp: new Date().toISOString()
        }
      });
    });
}

/**
 * Middleware para endpoints de API que manejan datos financieros
 */
export function financialSecurityMiddleware() {
  const financialConfig: SecurityHeadersConfig = {
    ...strictSecurityConfig,
    expectCt: {
      maxAge: 43200, // 12 horas más estricto
      enforce: true,
      reportUri: '/api/expect-ct-report'
    },
    noCache: true,
    contentSecurityPolicy: {
      ...strictSecurityConfig.contentSecurityPolicy,
      'report-uri': ['/api/financial-csp-report'] // Reporte específico
    }
  };

  return new Elysia({ name: 'financial-security' })
    .use(securityHeaders(financialConfig))
    .onRequest((context) => {
      // Validaciones adicionales para endpoints financieros
      const clientIP = getClientIP(context);
      const userAgent = context.request.headers.get('user-agent') || 'unknown';
      
      // Verificar que la conexión sea HTTPS
      if (!context.request.url.startsWith('https://') && process.env.NODE_ENV === 'production') {
        SecurityLogger.logAttackAttempt({
          type: 'attack_attempt',
          attackType: 'unknown',
          severity: 'high',
          ip: clientIP,
          userAgent,
          endpoint: new URL(context.request.url).pathname,
          method: context.request.method,
          blocked: true,
          source: 'headers',
          details: {
            type: 'insecure_financial_access',
            protocol: new URL(context.request.url).protocol,
            timestamp: new Date().toISOString()
          }
        });
        
        return new Response('HTTPS Required', { status: 400 });
      }

      // Log de acceso a endpoint financiero
      SecurityLogger.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'high',
        ip: clientIP,
        userAgent,
        endpoint: new URL(context.request.url).pathname,
        method: context.request.method,
        details: {
          type: 'financial_endpoint_access',
          timestamp: new Date().toISOString(),
          requiresAudit: true
        }
      });
    });
}

/**
 * Middleware específico para endpoints de autenticación
 */
export function authSecurityMiddleware() {
  const authConfig: SecurityHeadersConfig = {
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    contentSecurityPolicy: {
      'default-src': ["'none'"],
      'script-src': ["'none'"],
      'style-src': ["'none'"],
      'img-src': ["'none'"],
      'connect-src': ["'self'"],
      'base-uri': ["'none'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'report-uri': ['/api/auth-csp-report']
    },
    cors: {
      origin: process.env.AUTH_ALLOWED_ORIGINS?.split(',') || true,
      credentials: true,
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 3600
    },
    permissionsPolicy: {
      // Deshabilitar todas las APIs del navegador para auth
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      'picture-in-picture': ["'none'"],
      autoplay: ["'none'"],
      'encrypted-media': ["'none'"],
      fullscreen: ["'none'"],
      midi: ["'none'"],
      'sync-xhr': ["'none'"]
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: 'no-referrer',
    crossOriginEmbedderPolicy: 'require-corp',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    hideServer: true,
    dnsPrefetchControl: true,
    ieNoOpen: true,
    noCache: true
  };

  return new Elysia({ name: 'auth-security' })
    .use(securityHeaders(authConfig))
    .onRequest((context) => {
      const clientIP = getClientIP(context);
      const endpoint = new URL(context.request.url).pathname;
      
      // Detectar patrones de ataque común en endpoints de auth
      const suspiciousPatterns = [
        '/admin', '/administrator', '/wp-admin', '/phpMyAdmin',
        '.php', '.asp', '.aspx', '..', '/etc/', '/proc/',
        '<script', 'javascript:', 'data:text/html'
      ];

      const urlPath = decodeURIComponent(endpoint.toLowerCase());
      const isSuspicious = suspiciousPatterns.some(pattern => urlPath.includes(pattern));

      if (isSuspicious) {
        SecurityLogger.logAttackAttempt({
          type: 'attack_attempt',
          attackType: 'path_traversal',
          severity: 'high',
          ip: clientIP,
          userAgent: context.request.headers.get('user-agent') || undefined,
          endpoint,
          method: context.request.method,
          blocked: true,
          source: 'params',
          details: {
            type: 'suspicious_auth_endpoint_access',
            suspiciousPath: endpoint,
            timestamp: new Date().toISOString()
          }
        });

        return new Response('Not Found', { status: 404 });
      }

      // Rate limiting adicional para auth endpoints
      SecurityLogger.logSecurityEvent({
        type: 'authentication',
        severity: 'low',
        ip: clientIP,
        endpoint,
        method: context.request.method,
        details: {
          type: 'auth_endpoint_access',
          timestamp: new Date().toISOString()
        }
      });
    });
}

/**
 * Middleware para validar certificados de cliente (mTLS)
 */
export function mutualTLSMiddleware() {
  return new Elysia({ name: 'mutual-tls' })
    .onRequest((context) => {
      // Solo aplicar en producción y con HTTPS
      if (process.env.NODE_ENV !== 'production' || !context.request.url.startsWith('https://')) {
        return;
      }

      const clientCert = context.request.headers.get('x-client-cert');
      const clientCertVerified = context.request.headers.get('x-client-cert-verified');

      // Verificar que el certificado del cliente esté presente y verificado
      if (process.env.REQUIRE_CLIENT_CERTS === 'true') {
        if (!clientCert || clientCertVerified !== 'SUCCESS') {
          SecurityLogger.logAttackAttempt({
            type: 'attack_attempt',
            attackType: 'unknown',
            severity: 'high',
            ip: getClientIP(context),
            userAgent: context.request.headers.get('user-agent') || undefined,
            endpoint: new URL(context.request.url).pathname,
            method: context.request.method,
            blocked: true,
            source: 'headers',
            details: {
              type: 'client_cert_missing',
              clientCertPresent: !!clientCert,
              clientCertVerified,
              timestamp: new Date().toISOString()
            }
          });

          return new Response('Client Certificate Required', { 
            status: 403,
            headers: {
              'Content-Type': 'text/plain'
            }
          });
        }

        // Log de acceso exitoso con certificado
        SecurityLogger.logSecurityEvent({
          type: 'authentication',
          severity: 'low',
          ip: getClientIP(context),
          endpoint: new URL(context.request.url).pathname,
          details: {
            type: 'mtls_success',
            clientCertPresent: true,
            timestamp: new Date().toISOString()
          }
        });
      }
    });
}

/**
 * Función auxiliar para obtener la IP del cliente
 */
function getClientIP(context: any): string {
  const forwarded = context.request.headers.get('x-forwarded-for');
  const realIP = context.request.headers.get('x-real-ip');
  const remoteAddr = context.request.headers.get('remote-addr');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (remoteAddr) {
    return remoteAddr;
  }
  
  try {
    return new URL(context.request.url).hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Plugin combinado para diferentes niveles de seguridad
 */
export function adaptiveSecurityMiddleware(level: 'basic' | 'strict' | 'admin' | 'financial' | 'auth') {
  switch (level) {
    case 'strict':
      return strictSecurityMiddleware();
    case 'admin':
      return adminSecurityMiddleware();
    case 'financial':
      return financialSecurityMiddleware();
    case 'auth':
      return authSecurityMiddleware();
    default:
      return new Elysia({ name: 'basic-security' });
  }
}

export {
  strictSecurityConfig,
  adminSecurityConfig
};
