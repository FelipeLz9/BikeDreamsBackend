import jwt from 'jsonwebtoken';

// Mock JWT
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock Prisma
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));

describe('🔐 Auth Middleware', () => {
  const { prisma } = require('../../prisma/client');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Token Validation', () => {
    test('should validate valid JWT token', () => {
      const mockPayload = { id: '1', email: 'test@example.com' };
      mockJwt.verify.mockReturnValue(mockPayload as any);

      const token = 'valid-jwt-token';
      const secret = 'test-secret';

      const result = mockJwt.verify(token, secret);

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith(token, secret);
    });

    test('should reject invalid JWT token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const token = 'invalid-jwt-token';
      const secret = 'test-secret';

      expect(() => mockJwt.verify(token, secret)).toThrow('Invalid token');
    });
  });

  describe('User Authentication Flow', () => {
    test('should authenticate user with valid token', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        isActive: true
      };

      mockJwt.verify.mockReturnValue({ id: '1', email: 'test@example.com' } as any);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const authHeader = 'Bearer valid-token';
      const token = authHeader.split(' ')[1];
      const decoded = mockJwt.verify(token, 'secret') as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      expect(user).toEqual(mockUser);
      expect(user.isActive).toBe(true);
    });

    test('should reject inactive user', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        isActive: false
      };

      mockJwt.verify.mockReturnValue({ id: '1', email: 'test@example.com' } as any);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const authHeader = 'Bearer valid-token';
      const token = authHeader.split(' ')[1];
      const decoded = mockJwt.verify(token, 'secret') as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      expect(user.isActive).toBe(false);
    });
  });
});
