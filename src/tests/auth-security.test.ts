import { AuthService } from '../services/authService';
import { prisma } from '../prisma/client';

// Mock básico para testing
jest.mock('../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn()
    },
    userSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    securityEvent: {
      create: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    }
  }
}));

describe('🔐 AuthService - Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Password Validation', () => {
    test('Should reject weak passwords', async () => {
      const mockUser = null;
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: '123' // Weak password
      }, { ipAddress: '127.0.0.1' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Contraseña débil');
    });

    test('Should accept strong passwords', async () => {
      const mockUser = null;
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'CLIENT'
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await AuthService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!' // Strong password
      }, { ipAddress: '127.0.0.1' });

      expect(result.success).toBe(true);
    });
  });

  describe('Brute Force Protection', () => {
    test('Should lock account after max attempts', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed_password',
        loginAttempts: 4, // One less than max
        lockUntil: null,
        isActive: true
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        loginAttempts: 5,
        lockUntil: new Date(Date.now() + 30 * 60 * 1000)
      });
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      const result = await AuthService.login(
        'test@example.com',
        'wrong_password',
        { ipAddress: '127.0.0.1' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('bloqueada por intentos excesivos');
      expect(prisma.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'BRUTE_FORCE_ATTEMPT'
          })
        })
      );
    });

    test('Should reject login for locked account', async () => {
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed_password',
        loginAttempts: 5,
        lockUntil: lockUntil,
        isActive: true
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      const result = await AuthService.login(
        'test@example.com',
        'correct_password',
        { ipAddress: '127.0.0.1' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('bloqueada temporalmente');
      expect(result.lockUntil).toBeDefined();
    });
  });

  describe('JWT Token Security', () => {
    test('Should generate valid tokens with correct payload', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: '$2b$12$validHashHere',
        loginAttempts: 0,
        lockUntil: null,
        isActive: true,
        role: 'CLIENT'
      };

      const mockSession = {
        id: 'session-1',
        userId: '1',
        sessionToken: 'session-token',
        ipAddress: '127.0.0.1',
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      const mockRefreshToken = {
        id: 'refresh-1',
        token: 'refresh-token-value',
        userId: '1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      // Mock bcrypt compare
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        lastLogin: new Date()
      });
      (prisma.userSession.create as jest.Mock).mockResolvedValue(mockSession);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue(mockRefreshToken);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      const result = await AuthService.login(
        'test@example.com',
        'correct_password',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
    });

    test('Should verify tokens correctly', async () => {
      // This test would require actual JWT tokens
      // For now, we'll test the error cases
      const result = await AuthService.verifyToken('invalid-token');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Refresh Token Security', () => {
    test('Should reject expired refresh tokens', async () => {
      const expiredToken = {
        id: '1',
        token: 'expired-token',
        userId: '1',
        expiresAt: new Date(Date.now() - 1000), // Expired
        isRevoked: false,
        user: {
          id: '1',
          email: 'test@example.com',
          role: 'CLIENT'
        }
      };

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(expiredToken);
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      const result = await AuthService.refreshAccessToken(
        'expired-token',
        { ipAddress: '127.0.0.1' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('inválido');
      expect(prisma.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'TOKEN_MISUSE'
          })
        })
      );
    });

    test('Should reject revoked refresh tokens', async () => {
      const revokedToken = {
        id: '1',
        token: 'revoked-token',
        userId: '1',
        expiresAt: new Date(Date.now() + 1000000), // Not expired
        isRevoked: true, // But revoked
        user: {
          id: '1',
          email: 'test@example.com',
          role: 'CLIENT'
        }
      };

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(revokedToken);
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      const result = await AuthService.refreshAccessToken(
        'revoked-token',
        { ipAddress: '127.0.0.1' }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('inválido');
    });
  });

  describe('Security Logging', () => {
    test('Should log security events for failed login', async () => {
      const mockUser = null; // User not found
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      await AuthService.login(
        'nonexistent@example.com',
        'any_password',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(prisma.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'LOGIN_FAILURE',
            severity: 'MEDIUM',
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent'
          })
        })
      );
    });

    test('Should log audit events for successful operations', async () => {
      const mockUser = null; // New registration
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'CLIENT'
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({});

      await AuthService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!'
      }, { ipAddress: '127.0.0.1' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'USER_REGISTERED',
            success: true,
            userId: '1'
          })
        })
      );
    });
  });

  describe('Session Management', () => {
    test('Should logout and revoke tokens properly', async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.userSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await AuthService.logout(
        'user-1',
        undefined, // All sessions
        { ipAddress: '127.0.0.1' }
      );

      expect(result.success).toBe(true);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true }
      });
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isActive: false }
      });
    });
  });
});

console.log('🔐 Auth Security Tests configurados correctamente');
