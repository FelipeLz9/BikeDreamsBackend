// Mock de las dependencias problemáticas antes de importar el servicio
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn()
    },
    securityEvent: {
      create: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    }
  }
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({ id: '1', email: 'test@example.com', role: 'CLIENT' })),
  JsonWebTokenError: class JsonWebTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  },
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(message: string, expiredAt: Date) {
      super(message);
      this.name = 'TokenExpiredError';
      (this as any).expiredAt = expiredAt;
    }
  }
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(() => 'hashed-password'),
  compare: jest.fn(() => true)
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid'),
  randomBytes: jest.fn(() => ({ toString: () => 'mock-random-bytes' }))
}));

// Importar AuthService después de los mocks
import { AuthService } from '../../services/authService';

describe('🔐 AuthService - Tests Básicos', () => {
  const { prisma } = require('../../prisma/client');
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcrypt');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('should register user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };
      
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password'
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.register(userData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Usuario registrado exitosamente');
      expect(result.user).toBeDefined();
      expect((result.user as any)?.password).toBeUndefined();
    });

    test('should fail if user already exists', async () => {
      const userData = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'SecurePass123!'
      };

      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'existing@example.com' });
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('El email ya está registrado');
    });

    test('should fail with weak password', async () => {
      const userData = {
        name: 'Test User',
        email: 'weakpassword@example.com',
        password: 'weak'
      };

      // Asegurar que no existe usuario con este email
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Contraseña débil');
    });
  });

  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed-password',
        loginAttempts: 0,
        lockUntil: null,
        role: 'CLIENT',
        name: 'Test User'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.userSession.create.mockResolvedValue({ id: 'session-1' });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      prisma.securityEvent.create.mockResolvedValue({});

      bcrypt.compare.mockResolvedValue(true);

      const result = await AuthService.login('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
    });

    test('should fail with invalid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed-password',
        loginAttempts: 0,
        lockUntil: null
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});
      prisma.securityEvent.create.mockResolvedValue({});

      bcrypt.compare.mockResolvedValue(false);

      const result = await AuthService.login('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Credenciales inválidas');
    });

    test('should fail with non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.login('nonexistent@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Credenciales inválidas');
    });

    test('should fail with locked account', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed-password',
        loginAttempts: 5,
        lockUntil: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos en el futuro
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.login('test@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cuenta bloqueada temporalmente');
      expect(result.lockUntil).toBeDefined();
    });
  });

  describe('refreshAccessToken', () => {
    test('should refresh token successfully', async () => {
      const mockRefreshToken = {
        token: 'valid-refresh-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: {
          id: '1',
          email: 'test@example.com',
          role: 'CLIENT'
        }
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.refreshAccessToken('valid-refresh-token');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
    });

    test('should fail with invalid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.refreshAccessToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Refresh token inválido');
    });

    test('should fail with revoked refresh token', async () => {
      const mockRefreshToken = {
        token: 'revoked-refresh-token',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: {
          id: '1',
          email: 'test@example.com',
          role: 'CLIENT'
        }
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.refreshAccessToken('revoked-refresh-token');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Refresh token inválido');
    });
  });

  describe('logout', () => {
    test('should logout successfully', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({});
      prisma.userSession.updateMany.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.logout('user-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logout exitoso');
    });

    test('should logout specific session successfully', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({});
      prisma.userSession.update.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.logout('user-1', 'session-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logout exitoso');
    });
  });

  describe('verifyToken', () => {
    test('should verify valid token successfully', async () => {
      const mockPayload = {
        id: '1',
        email: 'test@example.com',
        role: 'CLIENT',
        sessionId: 'session-1'
      };

      const mockSession = {
        id: 'session-1',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      jwt.verify.mockReturnValue(mockPayload);
      prisma.userSession.findUnique.mockResolvedValue(mockSession);
      prisma.userSession.update.mockResolvedValue({});

      const result = await AuthService.verifyToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(mockPayload);
    });

    test('should fail with invalid token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const result = await AuthService.verifyToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token inválido');
    });

    test('should fail with expired token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      const result = await AuthService.verifyToken('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expirado');
    });
  });

  describe('cleanupExpiredTokens', () => {
    test('should cleanup expired tokens and sessions', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });
      prisma.userSession.updateMany.mockResolvedValue({ count: 3 });

      await AuthService.cleanupExpiredTokens();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
      expect(prisma.userSession.updateMany).toHaveBeenCalled();
    });
  });
});
