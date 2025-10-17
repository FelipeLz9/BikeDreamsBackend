import { Elysia } from 'elysia';
import { prisma } from '../prisma/client';
import { SecurityEventType, LogSeverity } from '@prisma/client';

// Configuración de rate limiting
const RATE_LIMIT_CONFIG = {
  // Rate limits por endpoint
  login: { windowMs: 15 * 60 * 1000, maxAttempts: 5 }, // 5 intentos por 15 min
  register: { windowMs: 60 * 60 * 1000, maxAttempts: 3 }, // 3 intentos por hora
  refresh: { windowMs: 15 * 60 * 1000, maxAttempts: 10 }, // 10 intentos por 15 min
  global: { windowMs: 15 * 60 * 1000, maxAttempts: 100 }, // 100 requests por 15 min
  admin: { windowMs: 10 * 60 * 1000, maxAttempts: 30 }, // 30 requests por 10 min
};

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// Store en memoria (en producción usar Redis)
const rateLimitStore: RateLimitStore = {};

export const rateLimiterMiddleware = new Elysia()
  .derive(({ headers, request }) => {
    // Extraer IP del cliente
    const forwarded = headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               headers['x-real-ip'] as string || 
               'unknown';
    
    return { clientIp: ip, userAgent: headers['user-agent'] || 'unknown' };
  })
  .onBeforeHandle(async ({ request, clientIp, userAgent, path }) => {
    // Determinar configuración de rate limit basada en la ruta
    let config = RATE_LIMIT_CONFIG.global;
    let rateLimitType = 'global';

    if (path.includes('/auth/login')) {
      config = RATE_LIMIT_CONFIG.login;
      rateLimitType = 'login';
    } else if (path.includes('/auth/register')) {
      config = RATE_LIMIT_CONFIG.register;
      rateLimitType = 'register';
    } else if (path.includes('/auth/refresh')) {
      config = RATE_LIMIT_CONFIG.refresh;
      rateLimitType = 'refresh';
    } else if (path.includes('/admin')) {
      config = RATE_LIMIT_CONFIG.admin;
      rateLimitType = 'admin';
    }

    // Crear clave única para el rate limit
    const key = `${rateLimitType}:${clientIp}`;
    const now = Date.now();

    // Verificar o inicializar el store
    if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
      rateLimitStore[key] = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    // Incrementar contador
    rateLimitStore[key].count++;

    // Verificar si excede el límite
    if (rateLimitStore[key].count > config.maxAttempts) {
      // Log del evento de seguridad
      await logSecurityEvent({
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: LogSeverity.MEDIUM,
        description: `Rate limit excedido para ${rateLimitType} desde IP: ${clientIp}`,
        ipAddress: clientIp,
        userAgent: userAgent,
        metadata: {
          rateLimitType,
          attempts: rateLimitStore[key].count,
          maxAttempts: config.maxAttempts,
          windowMs: config.windowMs
        }
      });

      // Calcular tiempo hasta reset
      const resetTimeSeconds = Math.ceil((rateLimitStore[key].resetTime - now) / 1000);

      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Demasiadas peticiones. Intenta nuevamente en ${resetTimeSeconds} segundos.`,
        retryAfter: resetTimeSeconds
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': config.maxAttempts.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString(),
          'Retry-After': resetTimeSeconds.toString()
        }
      });
    }

    // Agregar headers informativos
    const remaining = Math.max(0, config.maxAttempts - rateLimitStore[key].count);
    
    return {
      headers: {
        'X-RateLimit-Limit': config.maxAttempts.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString()
      }
    };
  });

// Middleware específico para protección de rutas sensibles
export const createRateLimiter = (options: {
  windowMs: number;
  maxAttempts: number;
  keyGenerator?: (context: any) => string;
  skipSuccessfulRequests?: boolean;
}) => {
  return new Elysia()
    .derive(({ headers, request }) => {
      const forwarded = headers['x-forwarded-for'] as string;
      const ip = forwarded ? forwarded.split(',')[0].trim() : 
                 headers['x-real-ip'] as string || 
                 'unknown';
      
      return { clientIp: ip, userAgent: headers['user-agent'] || 'unknown' };
    })
    .onBeforeHandle(async (context) => {
      const { clientIp, userAgent, path } = context;
      
      // Generar clave personalizada si se proporciona
      const key = options.keyGenerator ? 
        options.keyGenerator(context) : 
        `custom:${clientIp}:${path}`;

      const now = Date.now();

      // Verificar o inicializar el store
      if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
        rateLimitStore[key] = {
          count: 0,
          resetTime: now + options.windowMs
        };
      }

      // Incrementar contador
      rateLimitStore[key].count++;

      // Verificar si excede el límite
      if (rateLimitStore[key].count > options.maxAttempts) {
        await logSecurityEvent({
          eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
          severity: LogSeverity.HIGH,
          description: `Rate limit personalizado excedido desde IP: ${clientIp}`,
          ipAddress: clientIp,
          userAgent: userAgent,
          metadata: {
            key,
            attempts: rateLimitStore[key].count,
            maxAttempts: options.maxAttempts,
            windowMs: options.windowMs
          }
        });

        const resetTimeSeconds = Math.ceil((rateLimitStore[key].resetTime - now) / 1000);

        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Demasiadas peticiones.',
          retryAfter: resetTimeSeconds
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': options.maxAttempts.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString(),
            'Retry-After': resetTimeSeconds.toString()
          }
        });
      }

      const remaining = Math.max(0, options.maxAttempts - rateLimitStore[key].count);
      
      return {
        headers: {
          'X-RateLimit-Limit': options.maxAttempts.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString()
        }
      };
    });
};

// Middleware para análisis de comportamiento sospechoso
export const suspiciousActivityDetection = new Elysia()
  .derive(({ headers }) => {
    const forwarded = headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               headers['x-real-ip'] as string || 
               'unknown';
    
    return { clientIp: ip, userAgent: headers['user-agent'] || 'unknown' };
  })
  .onBeforeHandle(async ({ clientIp, userAgent, request }) => {
    // Detectar patrones sospechosos
    const suspiciousPatterns = [
      // User agents sospechosos
      /bot|crawler|spider|scraper/i,
      // Headers maliciosos comunes
      /curl|wget|python|php/i,
      // Patrones de automatización
      /automation|selenium|headless/i
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(userAgent)
    );

    if (isSuspicious) {
      await logSecurityEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: LogSeverity.MEDIUM,
        description: `Actividad sospechosa detectada desde IP: ${clientIp}`,
        ipAddress: clientIp,
        userAgent: userAgent,
        metadata: {
          reason: 'suspicious_user_agent',
          url: request.url,
          method: request.method
        }
      });
    }
  });

// Función para limpiar store de rate limiting
export const cleanupRateLimitStore = () => {
  const now = Date.now();
  
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
};

// Log de eventos de seguridad
async function logSecurityEvent(event: {
  eventType: SecurityEventType;
  severity: LogSeverity;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  metadata?: any;
}) {
  try {
    await prisma.securityEvent.create({
      data: event
    });
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

// Middleware para bloqueo de IPs maliciosas
export const ipBlockingMiddleware = new Elysia()
  .derive(({ headers }) => {
    const forwarded = headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               headers['x-real-ip'] as string || 
               'unknown';
    
    return { clientIp: ip };
  })
  .onBeforeHandle(async ({ clientIp }) => {
    // Lista de IPs bloqueadas (en producción usar base de datos o Redis)
    const blockedIPs: Set<string> = new Set<string>([
      // ...
    ]);

    if (blockedIPs.has(clientIp)) {
      await logSecurityEvent({
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: LogSeverity.HIGH,
        description: `Acceso bloqueado desde IP maliciosa: ${clientIp}`,
        ipAddress: clientIp
      });

      return new Response(JSON.stringify({
        error: 'Access denied',
        message: 'Acceso denegado'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  });

// Cleanup periódico cada 5 minutos
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

// Rate limiter basado en roles de usuario
export const createRoleBasedRateLimiter = (roleLimits: {
  [role: string]: {
    windowMs: number;
    max: number;
  };
}) => {
  const defaultLimits = { windowMs: 15 * 60 * 1000, max: 100 }; // 100 requests en 15 minutos por defecto
  
  return new Elysia()
    .derive(({ headers, request }) => {
      const forwarded = headers['x-forwarded-for'] as string;
      const ip = forwarded ? forwarded.split(',')[0].trim() : 
                 headers['x-real-ip'] as string || 
                 'unknown';
      
      return { clientIp: ip, userAgent: headers['user-agent'] || 'unknown' };
    })
    .onBeforeHandle(async (context: any) => {
      const { clientIp, userAgent, path } = context;
      
      // Obtener el rol del usuario (se puede extraer del contexto/token)
      const userRole = context.user?.role || 'GUEST'; // Default a GUEST si no hay usuario autenticado
      
      // Obtener límites para el rol específico
      const limits = roleLimits[userRole] || defaultLimits;
      
      // Generar clave para el rate limit
      const key = `role-${userRole}:${clientIp}:${path}`;
      const now = Date.now();

      // Verificar o inicializar el store
      if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
        rateLimitStore[key] = {
          count: 0,
          resetTime: now + limits.windowMs
        };
      }

      // Incrementar contador
      rateLimitStore[key].count++;

      // Verificar si excede el límite
      if (rateLimitStore[key].count > limits.max) {
        await logSecurityEvent({
          eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
          severity: LogSeverity.HIGH,
          description: `Rate limit por rol excedido para ${userRole} desde IP: ${clientIp}`,
          ipAddress: clientIp,
          userAgent: userAgent,
          metadata: {
            userRole,
            attempts: rateLimitStore[key].count,
            maxAttempts: limits.max,
            windowMs: limits.windowMs
          }
        });

        const resetTimeSeconds = Math.ceil((rateLimitStore[key].resetTime - now) / 1000);

        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Límite de requests excedido para rol ${userRole}. Intenta nuevamente en ${resetTimeSeconds} segundos.`,
          retryAfter: resetTimeSeconds
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limits.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString(),
            'Retry-After': resetTimeSeconds.toString()
          }
        });
      }

      const remaining = Math.max(0, limits.max - rateLimitStore[key].count);
      
      return {
        headers: {
          'X-RateLimit-Limit': limits.max.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString()
        }
      };
    });
};

export { rateLimitStore };
