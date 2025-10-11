import { Elysia, Context, ValidationError } from 'elysia';
import { ZodSchema, ZodError } from 'zod';
import { SanitizerService } from '../services/sanitizerService.js';
import { SecurityLogger } from '../services/securityLogger.js';
import logger from '../utils/logger.js';

interface ValidationOptions {
  sanitize?: boolean;
  detectMalicious?: boolean;
  logAttempts?: boolean;
  contentType?: 'user' | 'event' | 'news' | 'forum' | 'donation';
}

interface ValidationErrorResponse {
  field: string;
  message: string;
  code: string;
  received?: any;
}

/**
 * Plugin de validación y sanitización para Elysia
 */
export function validationPlugin(options: ValidationOptions = {}) {
  const {
    sanitize = true,
    detectMalicious = true,
    logAttempts = true,
    contentType
  } = options;

  return new Elysia({ name: 'validation' })
    .derive((context) => {
      // Función para validar y sanitizar el body
      const validateBody = <T>(schema: ZodSchema<T>, body: any): T => {
        const errors: ValidationErrorResponse[] = [];

        if (!body) {
          throw new ValidationError('required', '/body', 'Cuerpo de la petición es requerido');
        }

        // Log del intento de validación
        if (logAttempts) {
          logger.info('Body validation attempt', {
            method: context.request.method,
            url: context.request.url,
            bodyKeys: body ? Object.keys(body) : [],
            timestamp: new Date().toISOString()
          });
        }

        let sanitizedBody = body;

        // Sanitizar antes de validar
        if (sanitize) {
          if (contentType) {
            sanitizedBody = SanitizerService.sanitizeByContentType(body, contentType);
          } else {
            sanitizedBody = SanitizerService.sanitizeFormData(body);
          }
        }

        // Detectar contenido malicioso
        if (detectMalicious) {
          const bodyString = JSON.stringify(sanitizedBody);
          const maliciousCheck = SanitizerService.detectMaliciousContent(bodyString);
          
          if (maliciousCheck.isSuspicious) {
            // Log en el sistema general
            logger.warn('Malicious content detected in body', {
              method: context.request.method,
              url: context.request.url,
              reasons: maliciousCheck.reasons,
              riskLevel: maliciousCheck.riskLevel,
              data: sanitizedBody
            });

            // Log específico de seguridad
            SecurityLogger.logAttackAttempt({
              type: 'attack_attempt',
              attackType: detectAttackType(maliciousCheck.reasons),
              severity: maliciousCheck.riskLevel === 'high' ? 'high' : maliciousCheck.riskLevel === 'medium' ? 'medium' : 'low',
              ip: getClientIP(context),
              userAgent: context.request.headers.get('user-agent') || undefined,
              endpoint: new URL(context.request.url).pathname,
              method: context.request.method,
              payload: JSON.stringify(sanitizedBody),
              blocked: maliciousCheck.riskLevel === 'high',
              source: 'body',
              details: {
                reasons: maliciousCheck.reasons,
                riskLevel: maliciousCheck.riskLevel,
                contentHash: SanitizerService.generateContentHash(JSON.stringify(sanitizedBody))
              }
            });

            if (maliciousCheck.riskLevel === 'high') {
              throw new ValidationError(
                'malicious_content', 
                '/body', 
                'Contenido potencialmente malicioso detectado'
              );
            }
          }
        }

        try {
          return schema.parse(sanitizedBody);
        } catch (error) {
          if (error instanceof ZodError) {
            const zodErrors = formatZodError(error, 'body');
            logger.warn('Body validation failed', {
              method: context.request.method,
              url: context.request.url,
              errors: zodErrors
            });
            
            throw new ValidationError(
              'validation_failed',
              '/body',
              `Errores de validación: ${zodErrors.map(e => e.message).join(', ')}`
            );
          }
          throw error;
        }
      };

      // Función para validar query parameters
      const validateQuery = <T>(schema: ZodSchema<T>, query: any): T => {
        if (!query) {
          throw new ValidationError('required', '/query', 'Query parameters son requeridos');
        }

        let sanitizedQuery = query;
        
        if (sanitize) {
          sanitizedQuery = SanitizerService.sanitizeObject(query);
        }

        try {
          return schema.parse(sanitizedQuery);
        } catch (error) {
          if (error instanceof ZodError) {
            const zodErrors = formatZodError(error, 'query');
            logger.warn('Query validation failed', {
              method: context.request.method,
              url: context.request.url,
              errors: zodErrors
            });
            
            throw new ValidationError(
              'validation_failed',
              '/query',
              `Errores de validación en query: ${zodErrors.map(e => e.message).join(', ')}`
            );
          }
          throw error;
        }
      };

      // Función para validar parámetros de ruta
      const validateParams = <T>(schema: ZodSchema<T>, params: any): T => {
        if (!params) {
          throw new ValidationError('required', '/params', 'Parámetros de ruta son requeridos');
        }

        let sanitizedParams = params;
        
        if (sanitize) {
          sanitizedParams = SanitizerService.sanitizeObject(params);
        }

        try {
          return schema.parse(sanitizedParams);
        } catch (error) {
          if (error instanceof ZodError) {
            const zodErrors = formatZodError(error, 'params');
            logger.warn('Params validation failed', {
              method: context.request.method,
              url: context.request.url,
              errors: zodErrors
            });
            
            throw new ValidationError(
              'validation_failed',
              '/params',
              `Errores de validación en parámetros: ${zodErrors.map(e => e.message).join(', ')}`
            );
          }
          throw error;
        }
      };

      // Función de sanitización rápida
      const quickSanitize = (data: any) => {
        if (contentType) {
          return SanitizerService.sanitizeByContentType(data, contentType);
        }
        return SanitizerService.sanitizeFormData(data);
      };

      return {
        validateBody,
        validateQuery,
        validateParams,
        quickSanitize,
        sanitizer: SanitizerService
      };
    });
}

/**
 * Plugin específico para validación de archivos subidos
 */
export function fileValidationPlugin(options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
} = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB por defecto
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    required = false
  } = options;

  return new Elysia({ name: 'file-validation' })
    .derive((context) => {
      const validateFile = (file: any) => {
        if (!file && required) {
          throw new ValidationError('required', '/file', 'Archivo requerido');
        }

        if (!file) return null;

        const validation = SanitizerService.sanitizeFileUpload({
          name: file.name || file.originalname,
          size: file.size,
          type: file.type || file.mimetype,
          data: file.data || file.buffer
        });

        if (!validation.valid) {
          throw new ValidationError('invalid_file', '/file', validation.error || 'Archivo inválido');
        }

        if (file.size > maxSize) {
          throw new ValidationError(
            'file_too_large', 
            '/file', 
            `Archivo demasiado grande (máximo ${Math.round(maxSize / 1024 / 1024)}MB)`
          );
        }

        const fileType = file.type || file.mimetype;
        if (!allowedTypes.includes(fileType)) {
          throw new ValidationError(
            'invalid_file_type', 
            '/file', 
            `Tipo de archivo ${fileType} no permitido`
          );
        }

        return validation.sanitized;
      };

      return { validateFile };
    });
}

/**
 * Plugin para validación de paginación
 */
export function paginationPlugin() {
  return new Elysia({ name: 'pagination' })
    .derive((context) => {
      const validatePagination = (query: any) => {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const offset = (page - 1) * limit;

        // Límites de seguridad
        const maxLimit = 100;
        const maxPage = 10000;

        if (page < 1 || page > maxPage) {
          throw new ValidationError(
            'invalid_page', 
            '/query/page', 
            `La página debe estar entre 1 y ${maxPage}`
          );
        }

        if (limit < 1 || limit > maxLimit) {
          throw new ValidationError(
            'invalid_limit', 
            '/query/limit', 
            `El límite debe estar entre 1 y ${maxLimit}`
          );
        }

        // Sanitizar otros parámetros
        const sort = query.sort ? SanitizerService.sanitizeString(query.sort) : undefined;
        const order = query.order && ['asc', 'desc'].includes(query.order.toLowerCase()) 
          ? query.order.toLowerCase() 
          : 'asc';
        const search = query.search ? SanitizerService.sanitizeSearchQuery(query.search) : undefined;

        return {
          page,
          limit,
          offset,
          sort,
          order: order as 'asc' | 'desc',
          search
        };
      };

      return { validatePagination };
    });
}

/**
 * Plugin para detección de contenido malicioso
 */
export function securityPlugin() {
  return new Elysia({ name: 'security' })
    .derive((context) => {
      const checkMaliciousContent = (content: string) => {
        const check = SanitizerService.detectMaliciousContent(content);
        
        if (check.isSuspicious) {
          logger.warn('Malicious content detected', {
            method: context.request.method,
            url: context.request.url,
            reasons: check.reasons,
            riskLevel: check.riskLevel
          });

          if (check.riskLevel === 'high') {
            throw new ValidationError(
              'malicious_content',
              '/content',
              'Contenido potencialmente malicioso detectado'
            );
          }
        }

        return check;
      };

      const generateContentHash = (content: string) => {
        return SanitizerService.generateContentHash(content);
      };

      return {
        checkMaliciousContent,
        generateContentHash
      };
    });
}

/**
 * Formatear errores de Zod a formato más amigable
 */
function formatZodError(error: ZodError, source: string): ValidationErrorResponse[] {
  return error.errors.map(err => ({
    field: `${source}.${err.path.join('.')}`,
    message: getSpanishErrorMessage(err.code, err.message),
    code: err.code,
    received: err.received
  }));
}

/**
 * Traducir mensajes de error de Zod al español
 */
function getSpanishErrorMessage(code: string, originalMessage: string): string {
  const messages: Record<string, string> = {
    'invalid_type': 'Tipo de dato inválido',
    'invalid_literal': 'Valor literal inválido',
    'unrecognized_keys': 'Propiedades no reconocidas',
    'invalid_union': 'No coincide con ninguna opción válida',
    'invalid_enum_value': 'Valor de enum inválido',
    'invalid_arguments': 'Argumentos inválidos',
    'invalid_return_type': 'Tipo de retorno inválido',
    'invalid_date': 'Fecha inválida',
    'invalid_string': 'Cadena de texto inválida',
    'too_small': 'Valor muy pequeño',
    'too_big': 'Valor muy grande',
    'invalid_intersection_types': 'Tipos de intersección inválidos',
    'not_multiple_of': 'No es múltiplo del valor requerido',
    'custom': 'Error de validación personalizada'
  };

  return messages[code] || originalMessage;
}

/**
 * Funciones auxiliares para logging de seguridad
 */
function detectAttackType(reasons: string[]): 'xss' | 'sql_injection' | 'csrf' | 'path_traversal' | 'command_injection' | 'brute_force' | 'dos' | 'unknown' {
  for (const reason of reasons) {
    if (reason.includes('script') || reason.includes('JavaScript')) return 'xss';
    if (reason.includes('SQL') || reason.includes('inyección')) return 'sql_injection';
    if (reason.includes('traversal') || reason.includes('directorios')) return 'path_traversal';
    if (reason.includes('iframe') || reason.includes('embed')) return 'xss';
  }
  return 'unknown';
}

function getClientIP(context: any): string {
  // Intentar obtener la IP real del cliente
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
  
  // Fallback - intentar extraer de la URL o usar localhost
  try {
    return new URL(context.request.url).hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Plugin combinado que incluye toda la funcionalidad de validación
export function fullValidationPlugin(options: ValidationOptions = {}) {
  return new Elysia({ name: 'full-validation' })
    .use(validationPlugin(options))
    .use(fileValidationPlugin())
    .use(paginationPlugin())
    .use(securityPlugin());
}
