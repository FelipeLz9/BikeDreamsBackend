import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import validator from 'validator';
import escapeHtml from 'escape-html';
import xss from 'xss';

// Configurar DOMPurify para servidor
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as any);

// Configuración de XSS
const xssOptions = {
  whiteList: {
    p: [],
    br: [],
    strong: [],
    em: [],
    u: [],
    ol: [],
    ul: [],
    li: [],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
    blockquote: [],
    code: [],
    pre: [],
    a: ['href', 'title', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false,
  css: false
};

export class SanitizerService {
  /**
   * Sanitizar string básico - remover caracteres peligrosos
   */
  static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Caracteres de control
      .replace(/\u0000/g, '') // Null bytes
      .substring(0, 10000); // Limitar longitud
  }

  /**
   * Sanitizar HTML - permitir solo tags seguros
   */
  static sanitizeHTML(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    // Primero limpiar con XSS
    let cleaned = xss(input, xssOptions);
    
    // Luego con DOMPurify para mayor seguridad
    cleaned = String(DOMPurify.sanitize(cleaned, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'code', 'pre', 'a', 'img'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'width', 'height', 'id'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
      KEEP_CONTENT: false
    } as any));
    
    return cleaned;
  }

  /**
   * Escapar HTML completamente - para mostrar como texto plano
   */
  static escapeHTML(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return escapeHtml(input);
  }

  /**
   * Sanitizar email
   */
  static sanitizeEmail(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    const email = input.toLowerCase().trim();
    return validator.isEmail(email) ? validator.normalizeEmail(email) || email : '';
  }

  /**
   * Sanitizar URL
   */
  static sanitizeURL(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    const url = input.trim();
    
    // Verificar que sea una URL válida
    if (!validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_host: true,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false
    })) {
      return '';
    }

    // Verificar que no contenga caracteres peligrosos
    if (/[\x00-\x20\x7f-\x9f]/.test(url)) {
      return '';
    }

    return url;
  }

  /**
   * Sanitizar nombre de usuario o nombre real
   */
  static sanitizeName(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[^\p{L}\p{N}\s\-_.]/gu, '') // Solo letras Unicode, números, espacios, guiones y puntos
      .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
      .substring(0, 100);
  }

  /**
   * Sanitizar contenido de texto largo (posts, comentarios)
   */
  static sanitizeContent(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    // Permitir HTML básico pero sanitizado
    let content = this.sanitizeHTML(input);
    
    // Limitar longitud
    content = content.substring(0, 50000);
    
    // Remover múltiples saltos de línea
    content = content.replace(/\n{3,}/g, '\n\n');
    
    return content;
  }

  /**
   * Sanitizar query de búsqueda
   */
  static sanitizeSearchQuery(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[^\p{L}\p{N}\s\-_]/gu, '') // Solo letras, números, espacios, guiones
      .replace(/\s+/g, ' ') // Múltiples espacios a uno
      .substring(0, 200);
  }

  /**
   * Sanitizar número de teléfono
   */
  static sanitizePhone(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    // Remover todo excepto números, espacios, guiones, paréntesis y +
    return input
      .trim()
      .replace(/[^\d\s\-\(\)+]/g, '')
      .substring(0, 20);
  }

  /**
   * Sanitizar coordenadas geográficas
   */
  static sanitizeCoordinates(lat: number, lng: number): { latitude: number | null; longitude: number | null } {
    const latitude = typeof lat === 'number' && lat >= -90 && lat <= 90 ? lat : null;
    const longitude = typeof lng === 'number' && lng >= -180 && lng <= 180 ? lng : null;
    
    return { latitude, longitude };
  }

  /**
   * Sanitizar objeto completo recursivamente
   */
  static sanitizeObject(obj: any, schema?: any, seen = new WeakSet()): any {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (typeof obj === 'number') {
      return isFinite(obj) ? obj : 0;
    }
    
    if (typeof obj === 'boolean') {
      return obj;
    }
    
    // Protección contra referencias circulares
    if (typeof obj === 'object' && obj !== null) {
      if (seen.has(obj)) {
        return {}; // Retornar objeto vacío para referencias circulares
      }
      seen.add(obj);
    }
    
    if (Array.isArray(obj)) {
      const result = obj.map(item => this.sanitizeObject(item, schema, seen)).slice(0, 1000); // Limitar arrays
      seen.delete(obj);
      return result;
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Limitar número de propiedades
        if (Object.keys(sanitized).length >= 100) break;
        
        // Sanitizar key
        const cleanKey = this.sanitizeString(key);
        if (cleanKey && cleanKey.length <= 100) {
          sanitized[cleanKey] = this.sanitizeObject(value, schema, seen);
        }
      }
      
      seen.delete(obj);
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Validar y sanitizar archivo subido
   */
  static sanitizeFileUpload(file: {
    name: string;
    size: number;
    type: string;
    data?: Buffer;
  }): { valid: boolean; sanitized?: any; error?: string } {
    
    if (!file || typeof file !== 'object') {
      return { valid: false, error: 'Archivo inválido' };
    }

    // Sanitizar nombre de archivo
    const safeName = file.name
      .replace(/[^\w\s.-]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 255);
    
    if (!safeName) {
      return { valid: false, error: 'Nombre de archivo inválido' };
    }

    // Validar tamaño
    if (file.size > 10 * 1024 * 1024) { // 10MB
      return { valid: false, error: 'Archivo demasiado grande' };
    }

    // Validar tipo MIME
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
      'application/json', 'application/xml'
    ];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Tipo de archivo no permitido' };
    }

    // Verificar extensión coincide con tipo MIME
    const extension = safeName.split('.').pop()?.toLowerCase();
    const typeExtensionMap: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/jpg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf'],
      'text/plain': ['txt'],
      'text/csv': ['csv'],
      'application/json': ['json'],
      'application/xml': ['xml']
    };

    const validExtensions = typeExtensionMap[file.type];
    if (extension && validExtensions && !validExtensions.includes(extension)) {
      return { valid: false, error: 'Extensión de archivo no coincide con el tipo' };
    }

    return {
      valid: true,
      sanitized: {
        name: safeName,
        size: file.size,
        type: file.type,
        data: file.data
      }
    };
  }

  /**
   * Limpiar datos de formulario completo
   */
  static sanitizeFormData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const cleanKey = this.sanitizeString(key);
      
      if (cleanKey) {
        switch (cleanKey) {
          case 'email':
            sanitized[cleanKey] = this.sanitizeEmail(value);
            break;
            
          case 'url':
          case 'website':
          case 'link':
            sanitized[cleanKey] = this.sanitizeURL(value);
            break;
            
          case 'name':
          case 'firstName':
          case 'lastName':
          case 'username':
            sanitized[cleanKey] = this.sanitizeName(value);
            break;
            
          case 'phone':
          case 'telephone':
          case 'mobile':
            sanitized[cleanKey] = this.sanitizePhone(value);
            break;
            
          case 'content':
          case 'description':
          case 'details':
          case 'message':
          case 'comment':
            sanitized[cleanKey] = this.sanitizeContent(value);
            break;
            
          case 'search':
          case 'query':
          case 'q':
            sanitized[cleanKey] = this.sanitizeSearchQuery(value);
            break;
            
          default:
            if (typeof value === 'string') {
              sanitized[cleanKey] = this.sanitizeString(value);
            } else {
              sanitized[cleanKey] = this.sanitizeObject(value);
            }
        }
      }
    }

    return sanitized;
  }

  /**
   * Detectar contenido potencialmente malicioso
   */
  static detectMaliciousContent(input: string): {
    isSuspicious: boolean;
    reasons: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (!input || typeof input !== 'string') {
      return { isSuspicious: false, reasons, riskLevel };
    }

    // Detectar scripts
    if (/<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(input)) {
      reasons.push('Contiene tags de script');
      riskLevel = 'high';
    }

    // Detectar eventos JavaScript
    if (/on\w+\s*=/gi.test(input)) {
      reasons.push('Contiene eventos JavaScript');
      riskLevel = 'high';
    }

    // Detectar javascript: URLs
    if (/javascript:/gi.test(input)) {
      reasons.push('Contiene URLs de JavaScript');
      riskLevel = 'high';
    }

    // Detectar data: URLs sospechosas
    if (/data:(?!image\/)/gi.test(input)) {
      reasons.push('Contiene URLs de datos sospechosas');
      riskLevel = 'medium';
    }

    // Detectar iframes
    if (/<iframe[\s\S]*?>/gi.test(input)) {
      reasons.push('Contiene iframes');
      riskLevel = 'medium';
    }

    // Detectar objetos y embeds
    if (/<(object|embed)[\s\S]*?>/gi.test(input)) {
      reasons.push('Contiene objetos embebidos');
      riskLevel = 'medium';
    }

    // Detectar formularios
    if (/<form[\s\S]*?>/gi.test(input)) {
      reasons.push('Contiene formularios');
      riskLevel = 'medium';
    }

    // Detectar SQL injection patterns
    const sqlPatterns = [
      /union\s+select/gi,
      /or\s+1\s*=\s*1/gi,
      /drop\s+table/gi,
      /insert\s+into/gi,
      /delete\s+from/gi,
      /update\s+.*set/gi
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        reasons.push('Contiene patrones de inyección SQL');
        riskLevel = 'high';
        break;
      }
    }

    // Detectar intentos de path traversal
    if (/\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\|%252e%252e%252f/gi.test(input)) {
      reasons.push('Contiene patrones de traversal de directorios');
      riskLevel = 'high';
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
      riskLevel
    };
  }

  /**
   * Generar hash de contenido para detectar spam/duplicados
   */
  static generateContentHash(content: string): string {
    if (!content) return '';
    
    // Normalizar contenido
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
    
    // Generar hash simple (en producción usar crypto.createHash)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Sanitizar datos específicos por tipo de contenido
   */
  static sanitizeByContentType(data: any, contentType: 'user' | 'event' | 'news' | 'forum' | 'donation'): any {
    const sanitized = this.sanitizeObject(data);

    switch (contentType) {
      case 'user':
        return {
          ...sanitized,
          name: this.sanitizeName(sanitized.name),
          email: this.sanitizeEmail(sanitized.email)
        };

      case 'event':
        return {
          ...sanitized,
          name: this.sanitizeString(sanitized.name),
          location: this.sanitizeString(sanitized.location),
          details: this.sanitizeContent(sanitized.details)
        };

      case 'news':
        return {
          ...sanitized,
          title: this.sanitizeString(sanitized.title),
          content: this.sanitizeContent(sanitized.content),
          author: this.sanitizeName(sanitized.author)
        };

      case 'forum':
        return {
          ...sanitized,
          title: this.sanitizeString(sanitized.title),
          content: this.sanitizeContent(sanitized.content)
        };

      case 'donation':
        return {
          ...sanitized,
          donorName: this.sanitizeName(sanitized.donorName),
          message: this.sanitizeString(sanitized.message)
        };

      default:
        return sanitized;
    }
  }
}
