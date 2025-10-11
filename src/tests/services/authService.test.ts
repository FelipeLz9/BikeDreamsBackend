// Mock de las dependencias problemáticas antes de importar el servicio
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  }
}));

// Mock de bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock de jsonwebtoken
class MockTokenExpiredError extends Error {
  constructor(message: string, expiredAt?: Date) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  JsonWebTokenError: Error,
  TokenExpiredError: MockTokenExpiredError,
}));

// Mock de crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-hex-string')
  })
}));

import { AuthService, LoginResult, TokenPayload } from '../../services/authService';
import { SecurityEventType, LogSeverity, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('🔐 Auth Service Tests', () => {
  const { prisma } = require('../../prisma/client');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.MAX_LOGIN_ATTEMPTS = '5';
    process.env.LOCKOUT_TIME = '30';
    process.env.BCRYPT_ROUNDS = '12';
  });

  describe('register', () => {
    const validUserData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent'
    };

    test('should register new user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'CLIENT' as Role,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.user.findUnique.mockResolvedValue(null); // User doesn't exist
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.register(validUserData, metadata);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Usuario registrado exitosamente');
      expect(result.user).toBeDefined();
      expect(result.user.password).toBeUndefined(); // Password should not be included

      expect(bcrypt.hash).toHaveBeenCalledWith(validUserData.password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: validUserData.name,
          email: validUserData.email,
          password: 'hashed-password',
        }
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    test('should fail when user already exists', async () => {
      const existingUser = { id: 'existing-user', email: validUserData.email };
      
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.register(validUserData, metadata);

      expect(result.success).toBe(false);
      expect(result.message).toBe('El email ya está registrado');
      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: SecurityEventType.LOGIN_ATTEMPT,
          severity: LogSeverity.INFO,
          description: `Intento de registro con email existente: ${validUserData.email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      });
    });

    test('should fail with weak password', async () => {
      const weakPasswordData = {
        ...validUserData,
        password: '123' // Too weak
      };

      prisma.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.register(weakPasswordData, metadata);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Contraseña débil');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await AuthService.register(validUserData, metadata);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error interno del servidor');
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'SecurePass123!'
    };

    const metadata = {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      deviceId: 'device-123'
    };

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password: 'hashed-password',
      role: 'CLIENT' as Role,
      loginAttempts: 0,
      lockUntil: null,
      isActive: true
    };

    test('should login successfully', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        sessionToken: 'session-token'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({ ...mockUser, loginAttempts: 0, lockUntil: null });
      prisma.userSession.create.mockResolvedValue(mockSession);
      prisma.refreshToken.create.mockResolvedValue({});
      (jwt.sign as jest.Mock).mockReturnValue('access-token');
      (crypto.randomUUID as jest.Mock).mockReturnValue('session-uuid');
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: () => 'refresh-token-hex'
      });
      prisma.securityEvent.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const result: LoginResult = await AuthService.login(
        loginData.email, 
        loginData.password, 
        metadata
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token-hex');
      expect(result.user).toBeDefined();
      expect(result.user.password).toBeUndefined();

      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          loginAttempts: 0,
          lockUntil: null,
          lastLogin: expect.any(Date)
        }
      });
    });

    test('should fail with non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.securityEvent.create.mockResolvedValue({});

      const result: LoginResult = await AuthService.login(
        loginData.email, 
        loginData.password, 
        metadata
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Credenciales inválidas');
      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: SecurityEventType.LOGIN_FAILURE,
          severity: LogSeverity.MEDIUM,
          description: `Intento de login con email inexistente: ${loginData.email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      });
    });

    test('should fail when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockUntil: new Date(Date.now() + 60000) // Locked for 1 minute
      };

      prisma.user.findUnique.mockResolvedValue(lockedUser);
      prisma.securityEvent.create.mockResolvedValue({});

      const result: LoginResult = await AuthService.login(
        loginData.email, 
        loginData.password, 
        metadata
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cuenta bloqueada temporalmente');
      expect(result.lockUntil).toEqual(lockedUser.lockUntil);
      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: SecurityEventType.ACCOUNT_LOCKED,
          severity: LogSeverity.HIGH,
          description: `Intento de login en cuenta bloqueada: ${loginData.email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          userId: mockUser.id
        }
      });
    });

    test('should increment login attempts on wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.user.update.mockResolvedValue({});
      prisma.securityEvent.create.mockResolvedValue({});

      const result: LoginResult = await AuthService.login(
        loginData.email, 
        'wrong-password', 
        metadata
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Credenciales inválidas');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          loginAttempts: 1
        }
      });
    });

    test('should lock account after max attempts', async () => {
      const userWithAttempts = {
        ...mockUser,
        loginAttempts: 4 // One more will trigger lock
      };

      prisma.user.findUnique.mockResolvedValue(userWithAttempts);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.user.update.mockResolvedValue({});
      prisma.securityEvent.create.mockResolvedValue({});

      const result: LoginResult = await AuthService.login(
        loginData.email, 
        'wrong-password', 
        metadata
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cuenta bloqueada por intentos excesivos');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userWithAttempts.id },
        data: {
          loginAttempts: 5,
          lockUntil: expect.any(Date)
        }
      });
      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
          severity: LogSeverity.HIGH,
          description: `Cuenta bloqueada por intentos excesivos: ${loginData.email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          userId: userWithAttempts.id
        }
      });
    });

    test('should handle database errors gracefully', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));
      prisma.securityEvent.create.mockResolvedValue({});

      const result: LoginResult = await AuthService.login(
        loginData.email, 
        loginData.password, 
        metadata
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error interno del servidor');
      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: SecurityEventType.LOGIN_FAILURE,
          severity: LogSeverity.HIGH,
          description: `Error interno en login: ${loginData.email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      });
    });
  });

  describe('refreshAccessToken', () => {
    const refreshToken = 'valid-refresh-token';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'Test Agent' };

    test('should refresh token successfully', async () => {
      const mockStoredToken = {
        token: refreshToken,
        userId: 'user-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 60000),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'CLIENT' as Role
        }
      };

      prisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      (jwt.sign as jest.Mock).mockReturnValue('new-access-token');
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.refreshAccessToken(refreshToken, metadata);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.message).toBe('Token renovado exitosamente');

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: mockStoredToken.user.id,
          email: mockStoredToken.user.email,
          role: mockStoredToken.user.role
        },
        expect.any(String),
        {
          expiresIn: '15m',
          issuer: 'bikedreams-api',
          audience: 'bikedreams-app'
        }
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    test('should fail with invalid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.refreshAccessToken(refreshToken, metadata);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Refresh token inválido');
      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: SecurityEventType.TOKEN_MISUSE,
          severity: LogSeverity.HIGH,
          description: 'Intento de uso de refresh token inválido',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      });
    });

    test('should fail with expired refresh token', async () => {
      const expiredToken = {
        token: refreshToken,
        isRevoked: false,
        expiresAt: new Date(Date.now() - 60000), // Expired
        user: { id: 'user-1' }
      };

      prisma.refreshToken.findUnique.mockResolvedValue(expiredToken);
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.refreshAccessToken(refreshToken, metadata);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Refresh token inválido');
    });

    test('should handle database errors gracefully', async () => {
      prisma.refreshToken.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await AuthService.refreshAccessToken(refreshToken, metadata);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error interno del servidor');
    });
  });

  describe('logout', () => {
    const userId = 'user-1';
    const sessionId = 'session-1';
    const metadata = { ipAddress: '127.0.0.1', userAgent: 'Test Agent' };

    test('should logout successfully with session ID', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({});
      prisma.userSession.update.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.logout(userId, sessionId, metadata);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logout exitoso');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { isRevoked: true }
      });
      expect(prisma.userSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { isActive: false }
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    test('should logout all sessions when no session ID provided', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({});
      prisma.userSession.updateMany.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.logout(userId, undefined, metadata);

      expect(result.success).toBe(true);
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { isActive: false }
      });
    });

    test('should handle database errors gracefully', async () => {
      prisma.refreshToken.updateMany.mockRejectedValue(new Error('Database error'));

      const result = await AuthService.logout(userId, sessionId, metadata);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error interno del servidor');
    });
  });

  describe('verifyToken', () => {
    const validToken = 'valid-jwt-token';

    test('should verify token successfully', async () => {
      const mockPayload: TokenPayload = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'CLIENT',
        sessionId: 'session-1'
      };

      const mockSession = {
        id: 'session-1',
        isActive: true,
        expiresAt: new Date(Date.now() + 60000)
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      prisma.userSession.findUnique.mockResolvedValue(mockSession);
      prisma.userSession.update.mockResolvedValue({});

      const result = await AuthService.verifyToken(validToken);

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(mockPayload);
      expect(prisma.userSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { lastActivity: expect.any(Date) }
      });
    });

    test('should fail with invalid session', async () => {
      const mockPayload: TokenPayload = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'CLIENT',
        sessionId: 'session-1'
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      prisma.userSession.findUnique.mockResolvedValue(null);

      const result = await AuthService.verifyToken(validToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Sesión inválida o expirada');
    });

    test('should handle JWT errors', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const result = await AuthService.verifyToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token inválido');
    });

    test('should handle expired token errors', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new MockTokenExpiredError('Token expired');
        throw error;
      });

      const result = await AuthService.verifyToken('expired-token');

      expect(result.valid).toBe(false);
      expect(['Token expirado', 'Token inválido']).toContain(result.error);
    });
  });

  describe('cleanupExpiredTokens', () => {
    test('should clean up expired tokens and sessions', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });
      prisma.userSession.updateMany.mockResolvedValue({ count: 3 });

      await AuthService.cleanupExpiredTokens();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { isRevoked: true }
          ]
        }
      });

      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { lastActivity: { lt: expect.any(Date) } }
          ]
        },
        data: { isActive: false }
      });
    });

    test('should handle database errors gracefully', async () => {
      prisma.refreshToken.deleteMany.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(AuthService.cleanupExpiredTokens()).resolves.not.toThrow();
    });
  });

  describe('password validation', () => {
    test('should validate password strength correctly', async () => {
      // Test through register method to access private method
      const weakPasswords = [
        { password: '123', expectedErrors: ['debe tener al menos 8 caracteres'] },
        { password: 'password', expectedErrors: ['debe contener al menos una mayúscula', 'debe contener al menos un número', 'debe contener al menos un símbolo especial'] },
        { password: 'PASSWORD', expectedErrors: ['debe contener al menos una minúscula', 'debe contener al menos un número', 'debe contener al menos un símbolo especial'] },
        { password: 'Password', expectedErrors: ['debe contener al menos un número', 'debe contener al menos un símbolo especial'] },
        { password: 'Password123', expectedErrors: ['debe contener al menos un símbolo especial'] }
      ];

      prisma.user.findUnique.mockResolvedValue(null); // No existing user

      for (const testCase of weakPasswords) {
        const result = await AuthService.register({
          name: 'Test',
          email: 'test@example.com',
          password: testCase.password
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Contraseña débil');
      }

      // Test strong password
      const result = await AuthService.register({
        name: 'Test',
        email: 'test@example.com',
        password: 'StrongPass123!'
      });

      // This should not fail due to password validation
      expect(result.message).not.toContain('Contraseña débil');
    });
  });
});
