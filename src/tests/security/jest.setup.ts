import { expect } from '@jest/globals';

// Matchers personalizados para tests de seguridad
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeBlockedBySecurityMiddleware(): R;
      toContainSecurityHeaders(): R;
      toHaveValidCSP(): R;
      toBlockMaliciousPayload(): R;
      toSanitizeInput(): R;
      toLogSecurityEvent(): R;
    }
  }
}

// Matcher para verificar que una respuesta fue bloqueada por middleware de seguridad
expect.extend({
  toBeBlockedBySecurityMiddleware(received: Response) {
    const pass = received.status >= 400 && received.status < 500;
    return {
      message: () => 
        pass 
          ? `Expected response not to be blocked by security middleware, but got status ${received.status}`
          : `Expected response to be blocked by security middleware, but got status ${received.status}`,
      pass,
    };
  },

  // Matcher para verificar headers de seguridad
  toContainSecurityHeaders(received: Response) {
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Content-Security-Policy',
      'Permissions-Policy',
      'Referrer-Policy'
    ];

    const missingHeaders = requiredHeaders.filter(header => 
      !received.headers.get(header)
    );

    const pass = missingHeaders.length === 0;

    return {
      message: () =>
        pass
          ? `Expected response not to contain all security headers`
          : `Expected response to contain security headers. Missing: ${missingHeaders.join(', ')}`,
      pass,
    };
  },

  // Matcher para validar CSP
  toHaveValidCSP(received: Response) {
    const cspHeader = received.headers.get('Content-Security-Policy');
    
    if (!cspHeader) {
      return {
        message: () => 'Expected response to have Content-Security-Policy header',
        pass: false,
      };
    }

    const requiredDirectives = [
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "connect-src"
    ];

    const missingDirectives = requiredDirectives.filter(directive => 
      !cspHeader.includes(directive)
    );

    const pass = missingDirectives.length === 0;

    return {
      message: () =>
        pass
          ? `Expected CSP not to contain all required directives`
          : `Expected CSP to contain required directives. Missing: ${missingDirectives.join(', ')}`,
      pass,
    };
  },

  // Matcher para verificar bloqueo de payloads maliciosos
  toBlockMaliciousPayload(received: Response) {
    const pass = received.status === 400 || received.status === 403;
    
    return {
      message: () =>
        pass
          ? `Expected malicious payload not to be blocked, but got status ${received.status}`
          : `Expected malicious payload to be blocked, but got status ${received.status}`,
      pass,
    };
  },

  // Matcher para verificar sanitización de input
  async toSanitizeInput(received: Response) {
    if (received.status !== 200) {
      return {
        message: () => `Cannot check input sanitization on non-200 response (status: ${received.status})`,
        pass: false,
      };
    }

    try {
      const data = await received.json();
      const dataString = JSON.stringify(data);
      
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /eval\s*\(/i,
        /'.*or.*1.*=.*1/i,
        /union.*select/i,
        /\.\.\//,
        /system\(/i,
        /exec\(/i
      ];

      const foundPatterns = dangerousPatterns.filter(pattern => 
        pattern.test(dataString)
      );

      const pass = foundPatterns.length === 0;

      return {
        message: () =>
          pass
            ? `Expected response to contain unsanitized input`
            : `Expected input to be sanitized, but found dangerous patterns: ${foundPatterns.map(p => p.toString()).join(', ')}`,
        pass,
      };
    } catch (error) {
      return {
        message: () => `Cannot parse response JSON: ${error}`,
        pass: false,
      };
    }
  },

  // Matcher para verificar logging de eventos de seguridad
  toLogSecurityEvent(received: any) {
    // Este matcher requiere que se configure un spy en el logger
    const pass = received && 
                 typeof received.logSecurityEvent === 'function' && 
                 received.logSecurityEvent.mock && 
                 received.logSecurityEvent.mock.calls.length > 0;

    return {
      message: () =>
        pass
          ? `Expected security event not to be logged`
          : `Expected security event to be logged`,
      pass,
    };
  }
});

// Configuración global para tests de seguridad
global.fetch = fetch;

// Configurar timeouts más largos para tests de carga
jest.setTimeout(60000);

// Mock global de FormData si no está disponible
if (typeof FormData === 'undefined') {
  global.FormData = class FormData {
    private data: Map<string, any> = new Map();
    
    append(key: string, value: any, filename?: string) {
      this.data.set(key, value);
    }
    
    get(key: string) {
      return this.data.get(key);
    }
    
    has(key: string) {
      return this.data.has(key);
    }
    
    entries() {
      return this.data.entries();
    }
  };
}

// Mock global de Blob si no está disponible
if (typeof Blob === 'undefined') {
  global.Blob = class Blob {
    size: number = 0;
    type: string = '';
    
    constructor(parts?: any[], options?: { type?: string }) {
      if (parts) {
        this.size = parts.reduce((acc, part) => acc + (part?.length || 0), 0);
      }
      if (options?.type) {
        this.type = options.type;
      }
    }
    
    text() {
      return Promise.resolve('mocked blob content');
    }
    
    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(this.size));
    }
  };
}
