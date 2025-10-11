import { Elysia } from 'elysia';
import { PermissionAction, Role } from '@prisma/client';

// Mock data
const mockAuthUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'CLIENT' as Role,
  isActive: true
};

// Mock de Prisma Client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn()
  },
  event: {
    findUnique: jest.fn()
  },
  forumPost: {
    findUnique: jest.fn()
  },
  donation: {
    findUnique: jest.fn()
  },
  securityEvent: {
    create: jest.fn()
  }
};

jest.mock('../../prisma/client.js', () => ({
  prisma: mockPrisma
}));

// Mock del RBACService
const mockRBACService = {
  checkPermission: jest.fn(),
  canManageUser: jest.fn()
};

jest.mock('../../services/rbacService.js', () => ({
  RBACService: mockRBACService
}));

// Mock del AuthService
const mockAuthService = {
  verifyToken: jest.fn()
};

jest.mock('../../services/authService.js', () => ({
  AuthService: mockAuthService
}));

// Import the middlewares after setting up mocks
import {
  requirePermission,
  requireRoles,
  requireMinRoleLevel
} from '../../middleware/rbacMiddleware';

describe('🔐 RBAC Middleware Tests - Working', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mocks por defecto para éxito
    mockRBACService.checkPermission.mockResolvedValue({
      allowed: true,
      reason: 'Permission granted'
    });
    mockRBACService.canManageUser.mockResolvedValue(true);
    mockPrisma.securityEvent.create.mockResolvedValue({});
    
    // Mock AuthService para simular token válido
    mockAuthService.verifyToken.mockResolvedValue({
      valid: true,
      payload: { id: 'user-123', email: 'test@example.com' }
    });
    
    // Mock Prisma user lookup para authMiddleware
    mockPrisma.user.findUnique.mockResolvedValue(mockAuthUser);
  });

  describe('requirePermission Middleware', () => {
    it('should allow access when user has permission', async () => {
      const app = new Elysia()
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
          'x-real-ip': '192.168.1.100',
          'user-agent': 'test-agent/1.0'
        }
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('success');
      
      expect(mockRBACService.checkPermission).toHaveBeenCalledWith({
        userId: 'user-123',
        resource: 'events',
        action: PermissionAction.READ,
        resourceId: undefined,
        context: {
          ipAddress: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          requestPath: '/test'
        }
      });
    });

    it('should deny access when user lacks permission', async () => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient permissions'
      });

      const app = new Elysia()
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
          'x-real-ip': '192.168.1.100',
          'user-agent': 'test-agent/1.0'
        }
      }));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Insufficient permissions');
    });

    it('should deny access for unauthenticated user (no token)', async () => {
      const app = new Elysia()
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test', {
        headers: {
          'x-real-ip': '192.168.1.100',
          'user-agent': 'test-agent/1.0'
        }
      }));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Autenticación requerida');
    });

    it('should deny access for invalid token', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        valid: false,
        error: 'Token expired'
      });

      const app = new Elysia()
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test', {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'x-real-ip': '192.168.1.100',
          'user-agent': 'test-agent/1.0'
        }
      }));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Autenticación requerida');
    });
  });

  describe('requireRoles Middleware', () => {
    it('should allow access for user with required role', async () => {
      // Setup user with ADMIN role
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockAuthUser,
        role: 'ADMIN'
      });

      const app = new Elysia()
        .use(requireRoles(['ADMIN', 'MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
          'x-real-ip': '192.168.1.100',
          'user-agent': 'test-agent/1.0'
        }
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('success');
    });

    it('should deny access for user without required roles', async () => {
      // Setup user sin roles adicionales (segunda llamada para requireRoles middleware)
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockAuthUser)  // Primera llamada: authMiddleware
        .mockResolvedValueOnce({              // Segunda llamada: requireRoles middleware
          id: 'user-123',
          role: 'CLIENT',
          roleAssignments: []
        });

      const app = new Elysia()
        .use(requireRoles(['ADMIN', 'MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test', {
        headers: {
          'Authorization': 'Bearer valid-token',
          'x-real-ip': '192.168.1.100',
          'user-agent': 'test-agent/1.0'
        }
      }));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('Roles requeridos: ADMIN, MODERATOR');
    });
  });
});