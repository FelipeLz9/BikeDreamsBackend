import { SanitizerService } from '../../services/sanitizerService';

// Mock de las dependencias problemáticas
jest.mock('jsdom', () => ({
  JSDOM: jest.fn(() => ({
    window: {
      DOMParser: jest.fn()
    }
  }))
}));

jest.mock('dompurify', () => {
  return jest.fn(() => ({
    sanitize: jest.fn((input: string) => input) // Simple mock que devuelve la entrada
  }));
});

describe('🧽 SanitizerService - Tests Básicos', () => {
  
  describe('sanitizeString', () => {
    test('should sanitize basic string', () => {
      const input = '  Hello World!  ';
      const result = SanitizerService.sanitizeString(input);
      expect(result).toBe('Hello World!');
    });

    test('should remove control characters', () => {
      const input = 'Hello\x00\x08\x0B\x0CWorld';
      const result = SanitizerService.sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    test('should handle null and undefined inputs', () => {
      expect(SanitizerService.sanitizeString(null as any)).toBe('');
      expect(SanitizerService.sanitizeString(undefined as any)).toBe('');
      expect(SanitizerService.sanitizeString('')).toBe('');
    });

    test('should limit string length', () => {
      const input = 'a'.repeat(20000);
      const result = SanitizerService.sanitizeString(input);
      expect(result.length).toBe(10000);
    });
  });

  describe('sanitizeEmail', () => {
    test('should sanitize valid email', () => {
      const input = '  TEST@EXAMPLE.COM  ';
      const result = SanitizerService.sanitizeEmail(input);
      expect(result).toBe('test@example.com');
    });

    test('should return empty for invalid email', () => {
      const input = 'not-an-email';
      const result = SanitizerService.sanitizeEmail(input);
      expect(result).toBe('');
    });

    test('should handle malformed emails', () => {
      expect(SanitizerService.sanitizeEmail('user@')).toBe('');
      expect(SanitizerService.sanitizeEmail('@domain.com')).toBe('');
      expect(SanitizerService.sanitizeEmail('user@@domain.com')).toBe('');
    });
  });

  describe('sanitizeURL', () => {
    test('should accept valid HTTPS URL', () => {
      const input = 'https://example.com/path';
      const result = SanitizerService.sanitizeURL(input);
      expect(result).toBe('https://example.com/path');
    });

    test('should accept valid HTTP URL', () => {
      const input = 'http://example.com';
      const result = SanitizerService.sanitizeURL(input);
      expect(result).toBe('http://example.com');
    });

    test('should reject javascript URLs', () => {
      const input = 'javascript:alert("xss")';
      const result = SanitizerService.sanitizeURL(input);
      expect(result).toBe('');
    });

    test('should reject URLs without protocol', () => {
      const input = 'example.com';
      const result = SanitizerService.sanitizeURL(input);
      expect(result).toBe('');
    });

    test('should reject URLs with dangerous characters', () => {
      const input = 'https://example.com\x00\x01';
      const result = SanitizerService.sanitizeURL(input);
      expect(result).toBe('');
    });
  });

  describe('sanitizeName', () => {
    test('should sanitize basic name', () => {
      const input = '  Juan Carlos  ';
      const result = SanitizerService.sanitizeName(input);
      expect(result).toBe('Juan Carlos');
    });

    test('should allow unicode characters', () => {
      const input = 'José María Ñoño';
      const result = SanitizerService.sanitizeName(input);
      expect(result).toBe('José María Ñoño');
    });

    test('should limit length', () => {
      const input = 'A'.repeat(200);
      const result = SanitizerService.sanitizeName(input);
      expect(result.length).toBe(100);
    });
  });

  describe('sanitizePhone', () => {
    test('should sanitize phone number', () => {
      const input = '+1 (555) 123-4567';
      const result = SanitizerService.sanitizePhone(input);
      expect(result).toBe('+1 (555) 123-4567');
    });

    test('should remove invalid characters', () => {
      const input = '+1abc(555)def123-4567ghi';
      const result = SanitizerService.sanitizePhone(input);
      expect(result).toBe('+1(555)123-4567');
    });

    test('should limit length', () => {
      const input = '1234567890123456789012345';
      const result = SanitizerService.sanitizePhone(input);
      expect(result.length).toBe(20);
    });
  });

  describe('sanitizeCoordinates', () => {
    test('should accept valid coordinates', () => {
      const result = SanitizerService.sanitizeCoordinates(40.7128, -74.0060);
      expect(result.latitude).toBe(40.7128);
      expect(result.longitude).toBe(-74.0060);
    });

    test('should reject invalid latitude', () => {
      const result = SanitizerService.sanitizeCoordinates(100, -74.0060);
      expect(result.latitude).toBeNull();
      expect(result.longitude).toBe(-74.0060);
    });

    test('should reject invalid longitude', () => {
      const result = SanitizerService.sanitizeCoordinates(40.7128, 200);
      expect(result.latitude).toBe(40.7128);
      expect(result.longitude).toBeNull();
    });
  });

  describe('detectMaliciousContent', () => {
    test('should detect script tags', () => {
      const input = '<script>alert("xss")</script>';
      const result = SanitizerService.detectMaliciousContent(input);
      expect(result.isSuspicious).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.reasons).toContain('Contiene tags de script');
    });

    test('should detect javascript events', () => {
      const input = '<div onclick="alert()">Test</div>';
      const result = SanitizerService.detectMaliciousContent(input);
      expect(result.isSuspicious).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.reasons).toContain('Contiene eventos JavaScript');
    });

    test('should detect SQL injection patterns', () => {
      const input = 'SELECT * FROM users WHERE id = 1 OR 1=1';
      const result = SanitizerService.detectMaliciousContent(input);
      expect(result.isSuspicious).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.reasons).toContain('Contiene patrones de inyección SQL');
    });

    test('should detect path traversal', () => {
      const input = '../../etc/passwd';
      const result = SanitizerService.detectMaliciousContent(input);
      expect(result.isSuspicious).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.reasons).toContain('Contiene patrones de traversal de directorios');
    });

    test('should detect iframes', () => {
      const input = '<iframe src="malicious.html"></iframe>';
      const result = SanitizerService.detectMaliciousContent(input);
      expect(result.isSuspicious).toBe(true);
      expect(result.riskLevel).toBe('medium');
      expect(result.reasons).toContain('Contiene iframes');
    });

    test('should not flag safe content', () => {
      const input = 'This is a normal message with safe content.';
      const result = SanitizerService.detectMaliciousContent(input);
      expect(result.isSuspicious).toBe(false);
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('sanitizeFileUpload', () => {
    test('should accept valid image file', () => {
      const file = {
        name: 'test.jpg',
        size: 1024 * 1024, // 1MB
        type: 'image/jpeg'
      };
      const result = SanitizerService.sanitizeFileUpload(file);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.name).toBe('test.jpg');
    });

    test('should reject file too large', () => {
      const file = {
        name: 'large.jpg',
        size: 15 * 1024 * 1024, // 15MB
        type: 'image/jpeg'
      };
      const result = SanitizerService.sanitizeFileUpload(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('grande');
    });

    test('should reject disallowed file type', () => {
      const file = {
        name: 'malicious.exe',
        size: 1024,
        type: 'application/x-executable'
      };
      const result = SanitizerService.sanitizeFileUpload(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('permitido');
    });

    test('should sanitize dangerous filename', () => {
      const file = {
        name: '../../../malicious<script>.jpg',
        size: 1024,
        type: 'image/jpeg'
      };
      const result = SanitizerService.sanitizeFileUpload(file);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.name).not.toContain('../');
      expect(result.sanitized?.name).not.toContain('<script>');
    });

    test('should reject extension-type mismatch', () => {
      const file = {
        name: 'image.jpg',
        size: 1024,
        type: 'application/pdf'
      };
      const result = SanitizerService.sanitizeFileUpload(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('coincide');
    });
  });

  describe('generateContentHash', () => {
    test('should generate consistent hash for same content', () => {
      const content = 'This is test content';
      const hash1 = SanitizerService.generateContentHash(content);
      const hash2 = SanitizerService.generateContentHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe('');
    });

    test('should generate different hashes for different content', () => {
      const content1 = 'This is test content';
      const content2 = 'This is different content';
      const hash1 = SanitizerService.generateContentHash(content1);
      const hash2 = SanitizerService.generateContentHash(content2);
      expect(hash1).not.toBe(hash2);
    });

    test('should normalize content before hashing', () => {
      const content1 = '  This    is   test   content!  ';
      const content2 = 'This is test content';
      const hash1 = SanitizerService.generateContentHash(content1);
      const hash2 = SanitizerService.generateContentHash(content2);
      expect(hash1).toBe(hash2);
    });

    test('should handle empty content', () => {
      const hash = SanitizerService.generateContentHash('');
      expect(hash).toBe('');
    });
  });

  describe('Edge cases and security tests', () => {
    test('should handle very large objects', () => {
      const largeObject: any = {};
      for (let i = 0; i < 150; i++) {
        largeObject[`prop${i}`] = `value${i}`;
      }
      
      const result = SanitizerService.sanitizeObject(largeObject);
      expect(Object.keys(result).length).toBeLessThanOrEqual(100);
    });

    test('should handle very large arrays', () => {
      const largeArray = new Array(2000).fill('test');
      const result = SanitizerService.sanitizeObject(largeArray);
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    test('should handle circular references safely', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      // Should not throw error
      expect(() => {
        SanitizerService.sanitizeObject(obj);
      }).not.toThrow();
    });
  });
});
