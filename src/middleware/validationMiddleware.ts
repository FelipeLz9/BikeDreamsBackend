import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import rateLimit from 'express-rate-limit';
import { SanitizerService } from '../services/sanitizerService';
import logger from '../utils/logger';

// Configuración de rate limiting para validación
const validationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 intentos de validación por IP cada 15 min
  message: {
    error: 'Demasiados intentos de validación. Inténtalo de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configuración estricta para endpoints sensibles
const strictValidationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: 'Límite de validación estricta excedido. Inténtalo de nuevo más tarde.'
  }
});

interface ValidationOptions {
  sanitize?: boolean;
  detectMalicious?: boolean;
  logAttempts?: boolean;
  strictMode?: boolean;
  allowEmptyBody?: boolean;
  maxFileSize?: number;
  contentType?: 'user' | 'event' | 'news' | 'forum' | 'donation';
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
  received?: any;
}

/**
 * Middleware de validación principal
 */
export function validateRequest(
  schemas: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
  },
  options: ValidationOptions = {}
) {
  return [
    // Aplicar rate limiting
    options.strictMode ? strictValidationRateLimit : validationRateLimit,
    
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const {
          sanitize = true,
          detectMalicious = true,
          logAttempts = true,
          allowEmptyBody = false,
          contentType
        } = options;

        const errors: ValidationError[] = [];
        const originalData = {
          body: req.body,
          query: req.query,
          params: req.params,
          headers: req.headers
        };

        // Log del intento de validación si está habilitado
        if (logAttempts) {
          logger.info('Validation attempt', {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            bodyKeys: req.body ? Object.keys(req.body) : [],
            queryKeys: Object.keys(req.query),
            timestamp: new Date().toISOString()
          });
        }

        // Validar body
        if (schemas.body) {
          if (!req.body && !allowEmptyBody) {
            errors.push({
              field: 'body',
              message: 'Cuerpo de la petición es requerido',
              code: 'required'
            });
          } else if (req.body) {
            // Sanitizar antes de validar
            if (sanitize) {
              if (contentType) {
                req.body = SanitizerService.sanitizeByContentType(req.body, contentType);
              } else {
                req.body = SanitizerService.sanitizeFormData(req.body);
              }
            }

            // Detectar contenido malicioso
            if (detectMalicious) {
              const bodyString = JSON.stringify(req.body);
              const maliciousCheck = SanitizerService.detectMaliciousContent(bodyString);
              
              if (maliciousCheck.isSuspicious) {
                logger.warn('Malicious content detected', {
                  ip: req.ip,
                  userAgent: req.get('User-Agent'),
                  reasons: maliciousCheck.reasons,
                  riskLevel: maliciousCheck.riskLevel,
                  data: req.body
                });

                if (maliciousCheck.riskLevel === 'high') {
                  return res.status(400).json({
                    success: false,
                    error: 'Contenido potencialmente malicioso detectado',
                    details: 'La petición contiene elementos que podrían ser peligrosos'
                  });
                }
              }
            }

            try {
              req.body = schemas.body.parse(req.body);
            } catch (error) {
              if (error instanceof ZodError) {
                errors.push(...formatZodError(error, 'body'));
              }
            }
          }
        }

        // Validar query parameters
        if (schemas.query) {
          // Sanitizar query parameters
          if (sanitize) {
            req.query = SanitizerService.sanitizeObject(req.query);
          }

          try {
            req.query = schemas.query.parse(req.query);
          } catch (error) {
            if (error instanceof ZodError) {
              errors.push(...formatZodError(error, 'query'));
            }
          }
        }

        // Validar parámetros de ruta
        if (schemas.params) {
          // Sanitizar params
          if (sanitize) {
            req.params = SanitizerService.sanitizeObject(req.params);
          }

          try {
            req.params = schemas.params.parse(req.params);
          } catch (error) {
            if (error instanceof ZodError) {
              errors.push(...formatZodError(error, 'params'));
            }
          }
        }

        // Validar headers específicos
        if (schemas.headers) {
          try {
            schemas.headers.parse(req.headers);
          } catch (error) {
            if (error instanceof ZodError) {
              errors.push(...formatZodError(error, 'headers'));
            }
          }
        }

        // Si hay errores de validación
        if (errors.length > 0) {
          logger.warn('Validation failed', {
            ip: req.ip,
            method: req.method,
            url: req.originalUrl,
            errors,
            originalData: logAttempts ? originalData : undefined
          });

          return res.status(400).json({
            success: false,
            error: 'Errores de validación',
            details: errors,
            timestamp: new Date().toISOString()
          });
        }

        next();
      } catch (error) {
        logger.error('Validation middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          ip: req.ip,
          method: req.method,
          url: req.originalUrl
        });

        res.status(500).json({
          success: false,
          error: 'Error interno de validación'
        });
      }
    }
  ];
}

/**
 * Middleware específico para validar archivos subidos
 */
export function validateFileUpload(options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
} = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB por defecto
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    required = false
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as any;
    const file = req.file as any;

    // Si no hay archivos y son requeridos
    if (required && !files && !file) {
      return res.status(400).json({
        success: false,
        error: 'Archivo requerido',
        code: 'FILE_REQUIRED'
      });
    }

    // Si no hay archivos pero no son requeridos
    if (!files && !file) {
      return next();
    }

    const filesToValidate = [];
    if (file) filesToValidate.push(file);
    if (files) {
      if (Array.isArray(files)) {
        filesToValidate.push(...files);
      } else {
        Object.values(files).forEach((fileArray: any) => {
          if (Array.isArray(fileArray)) {
            filesToValidate.push(...fileArray);
          } else {
            filesToValidate.push(fileArray);
          }
        });
      }
    }

    const errors: string[] = [];

    for (const uploadedFile of filesToValidate) {
      const validation = SanitizerService.sanitizeFileUpload({
        name: uploadedFile.originalname || uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.mimetype || uploadedFile.type,
        data: uploadedFile.buffer || uploadedFile.data
      });

      if (!validation.valid) {
        errors.push(validation.error || 'Archivo inválido');
        continue;
      }

      // Validaciones adicionales
      if (uploadedFile.size > maxSize) {
        errors.push(`Archivo ${uploadedFile.originalname} es demasiado grande (máximo ${Math.round(maxSize / 1024 / 1024)}MB)`);
      }

      if (!allowedTypes.includes(uploadedFile.mimetype)) {
        errors.push(`Tipo de archivo ${uploadedFile.mimetype} no permitido`);
      }
    }

    if (errors.length > 0) {
      logger.warn('File validation failed', {
        ip: req.ip,
        errors,
        files: filesToValidate.map(f => ({
          name: f.originalname,
          size: f.size,
          type: f.mimetype
        }))
      });

      return res.status(400).json({
        success: false,
        error: 'Archivos inválidos',
        details: errors
      });
    }

    next();
  };
}

/**
 * Middleware para validar y sanitizar parámetros de paginación
 */
export function validatePagination() {
  return (req: Request, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Límites de seguridad
    const maxLimit = 100;
    const maxPage = 10000;

    if (page < 1 || page > maxPage) {
      return res.status(400).json({
        success: false,
        error: 'Número de página inválido',
        details: `La página debe estar entre 1 y ${maxPage}`
      });
    }

    if (limit < 1 || limit > maxLimit) {
      return res.status(400).json({
        success: false,
        error: 'Límite de resultados inválido',
        details: `El límite debe estar entre 1 y ${maxLimit}`
      });
    }

    // Sanitizar otros parámetros de query
    if (req.query.sort) {
      req.query.sort = SanitizerService.sanitizeString(req.query.sort as string);
    }

    if (req.query.order) {
      const order = (req.query.order as string).toLowerCase();
      req.query.order = ['asc', 'desc'].includes(order) ? order : 'asc';
    }

    if (req.query.search) {
      req.query.search = SanitizerService.sanitizeSearchQuery(req.query.search as string);
    }

    // Agregar parámetros sanitizados al request
    req.pagination = {
      page,
      limit,
      offset,
      sort: req.query.sort as string,
      order: req.query.order as 'asc' | 'desc',
      search: req.query.search as string
    };

    next();
  };
}

/**
 * Middleware para sanitización rápida sin validación estricta
 */
export function quickSanitize(contentType?: 'user' | 'event' | 'news' | 'forum' | 'donation') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
      if (contentType) {
        req.body = SanitizerService.sanitizeByContentType(req.body, contentType);
      } else {
        req.body = SanitizerService.sanitizeFormData(req.body);
      }
    }

    if (req.query) {
      req.query = SanitizerService.sanitizeObject(req.query);
    }

    if (req.params) {
      req.params = SanitizerService.sanitizeObject(req.params);
    }

    next();
  };
}

/**
 * Formatear errores de Zod a formato más amigable
 */
function formatZodError(error: ZodError, source: string): ValidationError[] {
  return error.errors.map(err => ({
    field: `${source}.${err.path.join('.')}`,
    message: getSpanishErrorMessage(err.code, err.message),
    code: err.code
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

// Tipos extendidos para Express
declare global {
  namespace Express {
    interface Request {
      pagination?: {
        page: number;
        limit: number;
        offset: number;
        sort?: string;
        order?: 'asc' | 'desc';
        search?: string;
      };
    }
  }
}

export default {
  validateRequest,
  validateFileUpload,
  validatePagination,
  quickSanitize
};
