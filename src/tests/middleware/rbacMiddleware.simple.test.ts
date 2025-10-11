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

// Mock getUserMaxLevel and logUnauthorizedAccess functions
const mockGetUserMaxLevel = jest.fn();
const mockLogUnauthorizedAccess = jest.fn();

// We need to mock these at the global level for the middleware to access them
global.getUserMaxLevel = mockGetUserMaxLevel;
global.logUnauthorizedAccess = mockLogUnauthorizedAccess;

// Import the middlewares after setting up mocks
import {
  requirePermission,
  requireRoles,
  requireMinRoleLevel,
  requireResourceOwnershipOrPermission,
  requireUserManagementPermission,
  conditionalPermission
} from '../../middleware/rbacMiddleware';

describe('🔐 RBAC Middleware Tests - Simple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mocks por defecto para éxito
    mockRBACService.checkPermission.mockResolvedValue({
      allowed: true,
      reason: 'Permission granted'
    });
    mockRBACService.canManageUser.mockResolvedValue(true);
    mockPrisma.securityEvent.create.mockResolvedValue({});
    mockGetUserMaxLevel.mockResolvedValue(90); // ADMIN level
    mockLogUnauthorizedAccess.mockResolvedValue(undefined);
    
    // Mock AuthService para simular token válido
    mockAuthService.verifyToken.mockResolvedValue({
      valid: true,
      payload: { id: 'user-123', email: 'test@example.com' }
    });
    
    // Mock Prisma user lookup para authMiddleware
    mockPrisma.user.findUnique.mockResolvedValue(mockAuthUser);
  });

  describe('Test Simple - requirePermission con token válido', () => {
    it('should allow access when user has permission', async () => {
      const app = new Elysia()
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      // Crear request con Authorization header
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
      const { requirePermission } = await import('../../middleware/rbacMiddleware');
      
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

      const { requirePermission } = await import('../../middleware/rbacMiddleware');
      
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

    it('should deny access for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockAuthUser,
        isActive: false
      });

      const { requirePermission } = await import('../../middleware/rbacMiddleware');
      
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

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Autenticación requerida');
    });
  });

  describe('Test Simple - requireRoles', () => {
    it('should allow access for user with required role', async () => {
      // Setup user with ADMIN role
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockAuthUser,
        role: 'ADMIN'
      });

      const { requireRoles } = await import('../../middleware/rbacMiddleware');
      
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

    it('should allow access for user with additional role assignment', async () => {
      // Setup user con role assignment
      mockPrisma.user.findUnique
        // First call: authMiddleware
        .mockResolvedValueOnce(mockAuthUser)
        // Second call: requireRoles middleware
        .mockResolvedValueOnce({
          id: 'user-123',
          role: 'CLIENT',
          roleAssignments: [
            {
              role: 'MODERATOR',
              isActive: true,
              expiresAt: null
            }
          ]
        });

      const { requireRoles } = await import('../../middleware/rbacMiddleware');
      
      const app = new Elysia()
        .use(requireRoles(['MODERATOR']))
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
      // Setup user sin roles adicionales
      mockPrisma.user.findUnique
        // First call: authMiddleware
        .mockResolvedValueOnce(mockAuthUser)
        // Second call: requireRoles middleware
        .mockResolvedValueOnce({
          id: 'user-123',
          role: 'CLIENT',
          roleAssignments: []
        });

      const { requireRoles } = await import('../../middleware/rbacMiddleware');
      
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

  describe('Test Simple - RequireMinRoleLevel', () => {
    it('should allow access for user with sufficient role level', async () => {
      mockGetUserMaxLevel.mockResolvedValue(90); // ADMIN level

      const { requireMinRoleLevel } = await import('../../middleware/rbacMiddleware');
      
      const app = new Elysia()
        .use(requireMinRoleLevel(50))
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
      expect(mockGetUserMaxLevel).toHaveBeenCalledWith('user-123');
    });

    it('should deny access for user with insufficient role level', async () => {
      mockGetUserMaxLevel.mockResolvedValue(20); // CLIENT level

      const { requireMinRoleLevel } = await import('../../middleware/rbacMiddleware');
      
      const app = new Elysia()
        .use(requireMinRoleLevel(50))
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
      expect(body.message).toBe('Nivel de autorización insuficiente');
    });
  });
});