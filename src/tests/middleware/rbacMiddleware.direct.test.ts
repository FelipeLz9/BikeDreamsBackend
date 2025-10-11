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

const mockRoleHierarchy = {
  SUPER_ADMIN: { level: 100 },
  ADMIN: { level: 90 },
  MODERATOR: { level: 70 },
  EDITOR: { level: 60 },
  EVENT_MANAGER: { level: 50 },
  USER_MANAGER: { level: 50 },
  VIEWER: { level: 30 },
  CLIENT: { level: 20 },
  GUEST: { level: 10 }
};

jest.mock('../../services/rbacService.js', () => ({
  RBACService: mockRBACService,
  ROLE_HIERARCHY: mockRoleHierarchy
}));

// Mock del authService
const mockAuthService = {
  verifyToken: jest.fn()
};

jest.mock('../../services/authService.js', () => ({
  AuthService: mockAuthService
}));

// Mock logUnauthorizedAccess function
const mockLogUnauthorizedAccess = jest.fn();
const mockGetUserMaxLevel = jest.fn();

// Mock functions at module level
jest.mock('../../middleware/rbacMiddleware.ts', () => {
  // Import the original module
  const originalModule = jest.requireActual('../../middleware/rbacMiddleware.ts');
  
  return {
    ...originalModule,
  };
});

// Mock global functions
global.getUserMaxLevel = mockGetUserMaxLevel;
global.logUnauthorizedAccess = mockLogUnauthorizedAccess;

// Importar los middlewares después de configurar los mocks
import {
  requirePermission,
  requireRoles,
  requireMinRoleLevel,
  requireResourceOwnershipOrPermission,
  requireUserManagementPermission,
  conditionalPermission
} from '../../middleware/rbacMiddleware';

describe('🔐 RBAC Middleware Tests - Direct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mocks por defecto para éxito
    mockRBACService.checkPermission.mockResolvedValue({
      allowed: true,
      reason: 'Permission granted'
    });
    mockRBACService.canManageUser.mockResolvedValue(true);
    mockPrisma.securityEvent.create.mockResolvedValue({});
    (global.getUserMaxLevel as jest.Mock).mockResolvedValue(90); // ADMIN level
    (global.logUnauthorizedAccess as jest.Mock).mockResolvedValue(undefined);
  });

  describe('requirePermission Middleware', () => {
    const createTestContext = (overrides: any = {}) => ({
      user: mockAuthUser,
      isAuthenticated: true,
      clientIp: '192.168.1.100',
      userAgent: 'test-agent/1.0',
      params: {},
      body: {},
      path: '/test',
      ...overrides
    });

    it('should allow access when user has permission', async () => {
      const app = new Elysia()
        .derive(() => createTestContext())
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

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
        .derive(() => createTestContext())
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Insufficient permissions');
    });

    it('should deny access for unauthenticated user', async () => {
      const app = new Elysia()
        .derive(() => createTestContext({
          isAuthenticated: false,
          user: null
        }))
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Autenticación requerida');
    });

    it('should extract resourceId from params', async () => {
      const app = new Elysia()
        .derive(() => createTestContext({
          params: { id: 'event-123' },
          path: '/events/event-123'
        }))
        .use(requirePermission('events', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id'
        }))
        .put('/events/:id', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/events/event-123', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'event-123'
        })
      );
    });

    it('should allow resource owner access', async () => {
      mockPrisma.forumPost.findUnique.mockResolvedValue({
        id: 'post-123',
        userId: 'user-123'
      });

      const app = new Elysia()
        .derive(() => createTestContext({
          params: { id: 'post-123' },
          path: '/forum/post-123'
        }))
        .use(requirePermission('forum', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id',
          allowResourceOwner: true
        }))
        .put('/forum/:id', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/forum/post-123', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      expect(mockPrisma.forumPost.findUnique).toHaveBeenCalledWith({
        where: { id: 'post-123' }
      });
      // RBACService no debería ser llamado si es propietario
      expect(mockRBACService.checkPermission).not.toHaveBeenCalled();
    });

    it('should use custom check function', async () => {
      const customCheck = jest.fn().mockResolvedValue(true);

      const app = new Elysia()
        .derive(() => createTestContext())
        .use(requirePermission('events', PermissionAction.READ, {
          customCheck
        }))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(200);
      expect(customCheck).toHaveBeenCalled();
      expect(mockRBACService.checkPermission).not.toHaveBeenCalled();
    });
  });

  describe('requireRoles Middleware', () => {
    it('should allow access for user with required role', async () => {
      const app = new Elysia()
        .derive(() => ({
          user: { ...mockAuthUser, role: 'ADMIN' },
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        }))
        .use(requireRoles(['ADMIN', 'MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(200);
      // No debería llamar a Prisma si ya tiene el rol principal
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should allow access for user with additional role assignment', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
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

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        }))
        .use(requireRoles(['MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(200);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: {
          roleAssignments: {
            where: {
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: expect.any(Date) } }
              ]
            }
          }
        }
      });
    });

    it('should deny access for user without required roles', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'CLIENT',
        roleAssignments: []
      });

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        }))
        .use(requireRoles(['ADMIN', 'MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('Roles requeridos: ADMIN, MODERATOR');
    });

    it('should ignore expired role assignments', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'CLIENT',
        roleAssignments: [
          {
            role: 'MODERATOR',
            isActive: true,
            expiresAt: yesterday // Expired
          }
        ]
      });

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        }))
        .use(requireRoles(['MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(403);
    });
  });

  describe('requireMinRoleLevel Middleware', () => {
    it('should allow access for user with sufficient role level', async () => {
      (global.getUserMaxLevel as jest.Mock).mockResolvedValue(90);

      const app = new Elysia()
        .derive(() => ({
          user: { ...mockAuthUser, role: 'ADMIN' },
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        }))
        .use(requireMinRoleLevel(50))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(200);
      expect(global.getUserMaxLevel).toHaveBeenCalledWith('user-123');
    });

    it('should deny access for user with insufficient role level', async () => {
      (global.getUserMaxLevel as jest.Mock).mockResolvedValue(20); // CLIENT level

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        }))
        .use(requireMinRoleLevel(50))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Nivel de autorización insuficiente');
    });
  });

  describe('requireResourceOwnershipOrPermission Middleware', () => {
    it('should allow access for resource owner', async () => {
      mockPrisma.forumPost.findUnique.mockResolvedValue({
        id: 'post-123',
        userId: 'user-123'
      });

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          params: { postId: 'post-123' }
        }))
        .use(requireResourceOwnershipOrPermission('forum', PermissionAction.UPDATE, 'postId'))
        .put('/forum/:postId', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/forum/post-123', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).not.toHaveBeenCalled();
    });

    it('should check permissions for non-owner', async () => {
      mockPrisma.forumPost.findUnique.mockResolvedValue({
        id: 'post-123',
        userId: 'other-user-456'
      });

      mockRBACService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Has moderation permission'
      });

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          params: { postId: 'post-123' }
        }))
        .use(requireResourceOwnershipOrPermission('forum', PermissionAction.MODERATE, 'postId'))
        .put('/forum/:postId', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/forum/post-123', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalled();
    });

    it('should return 400 for missing resource ID', async () => {
      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          params: {}
        }))
        .use(requireResourceOwnershipOrPermission('forum', PermissionAction.UPDATE, 'postId'))
        .put('/forum', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/forum', {
        method: 'PUT'
      }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.message).toBe('ID de recurso requerido');
    });
  });

  describe('requireUserManagementPermission Middleware', () => {
    it('should allow managing users of lower level', async () => {
      mockRBACService.canManageUser.mockResolvedValue(true);

      const app = new Elysia()
        .derive(() => ({
          user: { ...mockAuthUser, role: 'ADMIN' },
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          params: { userId: 'target-user-456' }
        }))
        .use(requireUserManagementPermission())
        .put('/users/:userId', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/users/target-user-456', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      expect(mockRBACService.canManageUser).toHaveBeenCalledWith('user-123', 'target-user-456');
    });

    it('should deny managing users of equal or higher level', async () => {
      mockRBACService.canManageUser.mockResolvedValue(false);

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          params: { userId: 'admin-user-456' }
        }))
        .use(requireUserManagementPermission())
        .put('/users/:userId', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/users/admin-user-456', {
        method: 'PUT'
      }));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('No puedes gestionar usuarios de nivel superior o igual al tuyo');
    });
  });

  describe('conditionalPermission Middleware', () => {
    it('should apply first matching condition', async () => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Permission granted'
      });

      const conditions = [
        {
          condition: (ctx: any) => ctx.path.includes('/admin'),
          resource: 'admin',
          action: PermissionAction.READ,
          message: 'Admin access required'
        },
        {
          condition: (ctx: any) => ctx.path.includes('/events'),
          resource: 'events',
          action: PermissionAction.READ,
          message: 'Events access required'
        }
      ];

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          path: '/admin/dashboard'
        }))
        .use(conditionalPermission(conditions))
        .get('/admin/dashboard', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/admin/dashboard'));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalledWith({
        userId: 'user-123',
        resource: 'admin',
        action: PermissionAction.READ,
        context: {
          ipAddress: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        }
      });
    });

    it('should use custom message when permission denied', async () => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient admin permissions'
      });

      const conditions = [
        {
          condition: () => true,
          resource: 'admin',
          action: PermissionAction.READ,
          message: 'Custom admin access required'
        }
      ];

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        }))
        .use(conditionalPermission(conditions))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.message).toBe('Custom admin access required');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors in resource ownership check', async () => {
      mockPrisma.forumPost.findUnique.mockRejectedValue(new Error('Database error'));
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Permission granted'
      });

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          params: { id: 'post-123' },
          path: '/forum/post-123'
        }))
        .use(requirePermission('forum', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id',
          allowResourceOwner: true
        }))
        .put('/forum/:id', () => ({ message: 'success' }));

      const response = await app.handle(new Request('http://localhost/forum/post-123', {
        method: 'PUT'
      }));

      // Should fall back to RBAC check
      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalled();
    });

    it('should handle RBAC service errors gracefully', async () => {
      mockRBACService.checkPermission.mockRejectedValue(new Error('RBAC Service error'));

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          path: '/events'
        }))
        .use(requirePermission('events', PermissionAction.READ))
        .get('/events', () => ({ events: [] }));

      const response = await app.handle(new Request('http://localhost/events'));

      expect(response.status).toBe(403);
    });

    it('should log unauthorized access attempts', async () => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient permissions'
      });

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          path: '/admin'
        }))
        .use(requirePermission('admin', PermissionAction.READ))
        .get('/admin', () => ({ message: 'admin panel' }));

      const response = await app.handle(new Request('http://localhost/admin'));

      expect(response.status).toBe(403);
      expect(global.logUnauthorizedAccess).toHaveBeenCalledWith(
        'user-123',
        'admin', 
        PermissionAction.READ,
        '192.168.1.100',
        'test-agent/1.0',
        'Insufficient permissions'
      );
    });

    it('should handle missing user data in context', async () => {
      const app = new Elysia()
        .derive(() => ({
          user: null,
          isAuthenticated: false,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          path: '/events'
        }))
        .use(requirePermission('events', PermissionAction.READ))
        .get('/events', () => ({ events: [] }));

      const response = await app.handle(new Request('http://localhost/events'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('Permission Context Preservation', () => {
    it('should add permission context to request context', async () => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Permission granted',
        matchedPermission: { id: 'perm-123' }
      });

      let capturedContext: any;

      const app = new Elysia()
        .derive(() => ({
          user: mockAuthUser,
          isAuthenticated: true,
          clientIp: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          params: { id: 'event-123' },
          path: '/events/event-123'
        }))
        .use(requirePermission('events', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id'
        }))
        .put('/events/:id', (context) => {
          capturedContext = context;
          return { message: 'success' };
        });

      const response = await app.handle(new Request('http://localhost/events/event-123', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      expect(capturedContext.permissionContext).toEqual({
        resource: 'events',
        action: PermissionAction.UPDATE,
        resourceId: 'event-123',
        permissionResult: {
          allowed: true,
          reason: 'Permission granted',
          matchedPermission: { id: 'perm-123' }
        }
      });
    });
  });
});