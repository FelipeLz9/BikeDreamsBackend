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

// Mock completo del middleware de auth
jest.mock('../../middleware/auth.js', () => ({
  authMiddleware: new (require('elysia').Elysia)()
}));

// Función para crear contexto de prueba
const createTestContext = (overrides: any = {}) => ({
  user: mockAuthUser,
  isAuthenticated: true,
  clientIp: '192.168.1.100',
  userAgent: 'test-agent/1.0',
  params: {},
  body: {},
  path: '/test/path',
  ...overrides
});

// Importar los middlewares después de configurar los mocks
import {
  requirePermission,
  requireRoles,
  requireMinRoleLevel,
  requireResourceOwnershipOrPermission,
  requireUserManagementPermission,
  conditionalPermission,
  requireAdminAccess,
  requireModeratorAccess,
  requireEditorAccess,
  requireEventsRead,
  requireEventsWrite,
  requireEventsUpdate,
  requireEventsDelete,
  requireUsersManage,
  requireUsersRead,
  requireNewsModerate,
  requireNewsCreate,
  requireForumModerate,
  requireForumManage
} from '../../middleware/rbacMiddleware';

describe('🔐 RBAC Middleware Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Configurar mocks por defecto
    mockRBACService.checkPermission.mockResolvedValue({
      allowed: true,
      reason: 'Permission granted'
    });
    mockRBACService.canManageUser.mockResolvedValue(true);
    mockPrisma.securityEvent.create.mockResolvedValue({});
  });

  describe('requirePermission Middleware', () => {
    beforeEach(() => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Permission granted'
      });
    });

    it('should allow access when user has permission', async () => {
      // Crear el middleware y probarlo directamente
      const middleware = requirePermission('events', PermissionAction.READ);
      const testContext = createTestContext();
      
      // Simular el comportamiento del middleware
      let middlewareResult;
      const testApp = new Elysia()
        .derive(() => testContext)
        .use(middleware)
        .get('/test', () => ({ message: 'success' }));

      const response = await testApp.handle(new Request('http://localhost/test'));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalledWith({
        userId: 'user-123',
        resource: 'events',
        action: PermissionAction.READ,
        resourceId: undefined,
        context: {
          ipAddress: '192.168.1.100',
          userAgent: 'test-agent/1.0',
          requestPath: '/test/path'
        }
      });
    });

    it('should deny access when user lacks permission', async () => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient permissions'
      });

      const app = new Elysia()
        .use(createTestAuthMiddleware())
        .use(requirePermission('events', PermissionAction.CREATE))
        .post('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test', {
        method: 'POST'
      }));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Insufficient permissions');
    });

    it('should deny access for unauthenticated user', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ isAuthenticated: false, user: null }))
        .use(requirePermission('events', PermissionAction.READ))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Autenticación requerida');
    });

    it('should extract resourceId from params', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ params: { id: 'event-123' } }))
        .use(requirePermission('events', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id'
        }))
        .put('/events/:id', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/events/event-123', {
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
        .use(createTestAuthMiddleware({ params: { id: 'post-123' } }))
        .use(requirePermission('forum', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id',
          allowResourceOwner: true
        }))
        .put('/forum/:id', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/forum/post-123', {
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
        .use(createTestAuthMiddleware())
        .use(requirePermission('events', PermissionAction.READ, {
          customCheck
        }))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(200);
      expect(customCheck).toHaveBeenCalled();
      expect(mockRBACService.checkPermission).not.toHaveBeenCalled();
    });
  });

  describe('requireRoles Middleware', () => {
    it('should allow access for user with required role', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ user: { ...mockAuthUser, role: 'ADMIN' } }))
        .use(requireRoles(['ADMIN', 'MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(200);
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
        .use(createTestAuthMiddleware())
        .use(requireRoles(['MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

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
        .use(createTestAuthMiddleware())
        .use(requireRoles(['ADMIN', 'MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

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
        .use(createTestAuthMiddleware())
        .use(requireRoles(['MODERATOR']))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(403);
    });
  });

  describe('requireMinRoleLevel Middleware', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'CLIENT',
        roleAssignments: []
      });
    });

    it('should allow access for user with sufficient role level', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'ADMIN',
        roleAssignments: []
      });

      const app = new Elysia()
        .use(createTestAuthMiddleware({ user: { ...mockAuthUser, role: 'ADMIN' } }))
        .use(requireMinRoleLevel(50))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(200);
    });

    it('should deny access for user with insufficient role level', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware())
        .use(requireMinRoleLevel(50))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

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
        .use(createTestAuthMiddleware({ params: { postId: 'post-123' } }))
        .use(requireResourceOwnershipOrPermission('forum', PermissionAction.UPDATE, 'postId'))
        .put('/forum/:postId', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/forum/post-123', {
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
        .use(createTestAuthMiddleware({ params: { postId: 'post-123' } }))
        .use(requireResourceOwnershipOrPermission('forum', PermissionAction.MODERATE, 'postId'))
        .put('/forum/:postId', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/forum/post-123', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalled();
    });

    it('should return 400 for missing resource ID', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ params: {} }))
        .use(requireResourceOwnershipOrPermission('forum', PermissionAction.UPDATE, 'postId'))
        .put('/forum', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/forum', {
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
        .use(createTestAuthMiddleware({ 
          user: { ...mockAuthUser, role: 'ADMIN' },
          params: { userId: 'target-user-456' }
        }))
        .use(requireUserManagementPermission())
        .put('/users/:userId', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/users/target-user-456', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      expect(mockRBACService.canManageUser).toHaveBeenCalledWith('user-123', 'target-user-456');
    });

    it('should deny managing users of equal or higher level', async () => {
      mockRBACService.canManageUser.mockResolvedValue(false);

      const app = new Elysia()
        .use(createTestAuthMiddleware({ params: { userId: 'admin-user-456' } }))
        .use(requireUserManagementPermission())
        .put('/users/:userId', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/users/admin-user-456', {
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
        .use(createTestAuthMiddleware({ path: '/admin/dashboard' }))
        .use(conditionalPermission(conditions))
        .get('/admin/dashboard', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/admin/dashboard'));

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
        .use(createTestAuthMiddleware())
        .use(conditionalPermission(conditions))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.message).toBe('Custom admin access required');
    });
  });

  describe('Predefined Role Middlewares', () => {
    it('requireAdminAccess should accept SUPER_ADMIN and ADMIN', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ user: { ...mockAuthUser, role: 'ADMIN' } }))
        .use(requireAdminAccess)
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(200);
    });

    it('requireModeratorAccess should accept MODERATOR and above', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ user: { ...mockAuthUser, role: 'MODERATOR' } }))
        .use(requireModeratorAccess)
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(200);
    });

    it('requireEditorAccess should accept EDITOR and above', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ user: { ...mockAuthUser, role: 'EDITOR' } }))
        .use(requireEditorAccess)
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(200);
    });
  });

  describe('Predefined Permission Middlewares', () => {
    beforeEach(() => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Permission granted'
      });
    });

    it('requireEventsRead should check events.READ permission', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware())
        .use(requireEventsRead)
        .get('/events', () => ({ events: [] }));

      const response = await app.handle(new Request('https://localhost/events'));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'events',
          action: PermissionAction.READ
        })
      );
    });

    it('requireEventsWrite should check events.CREATE permission', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware())
        .use(requireEventsWrite)
        .post('/events', () => ({ message: 'created' }));

      const response = await app.handle(new Request('https://localhost/events', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'events',
          action: PermissionAction.CREATE
        })
      );
    });

    it('requireUsersManage should check users.MANAGE permission', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware())
        .use(requireUsersManage)
        .get('/admin/users', () => ({ users: [] }));

      const response = await app.handle(new Request('https://localhost/admin/users'));

      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'users',
          action: PermissionAction.MANAGE
        })
      );
    });
  });

  describe('Resource Ownership Checks', () => {
    it('should correctly identify user as owner of their own profile', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ params: { id: 'user-123' } }))
        .use(requirePermission('users', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id',
          allowResourceOwner: true
        }))
        .put('/users/:id', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/users/user-123', {
        method: 'PUT'
      }));

      expect(response.status).toBe(200);
      // Should not call RBAC service since user owns the resource
      expect(mockRBACService.checkPermission).not.toHaveBeenCalled();
    });

    it('should identify forum post ownership correctly', async () => {
      mockPrisma.forumPost.findUnique.mockResolvedValue({
        id: 'post-123',
        userId: 'user-123'
      });

      const app = new Elysia()
        .use(createTestAuthMiddleware({ params: { id: 'post-123' } }))
        .use(requirePermission('forum', PermissionAction.DELETE, {
          resourceIdFromParam: 'id',
          allowResourceOwner: true
        }))
        .delete('/forum/:id', () => ({ message: 'deleted' }));

      const response = await app.handle(new Request('https://localhost/forum/post-123', {
        method: 'DELETE'
      }));

      expect(response.status).toBe(200);
      expect(mockPrisma.forumPost.findUnique).toHaveBeenCalledWith({
        where: { id: 'post-123' }
      });
    });

    it('should check donation ownership correctly', async () => {
      mockPrisma.donation.findUnique.mockResolvedValue({
        id: 'donation-123',
        userId: 'user-123'
      });

      const app = new Elysia()
        .use(createTestAuthMiddleware({ params: { id: 'donation-123' } }))
        .use(requirePermission('donations', PermissionAction.READ, {
          resourceIdFromParam: 'id',
          allowResourceOwner: true
        }))
        .get('/donations/:id', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/donations/donation-123'));

      expect(response.status).toBe(200);
      expect(mockPrisma.donation.findUnique).toHaveBeenCalledWith({
        where: { id: 'donation-123' }
      });
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
        .use(createTestAuthMiddleware({ params: { id: 'post-123' } }))
        .use(requirePermission('forum', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id',
          allowResourceOwner: true
        }))
        .put('/forum/:id', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/forum/post-123', {
        method: 'PUT'
      }));

      // Should fall back to RBAC check
      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalled();
    });

    it('should handle RBAC service errors gracefully', async () => {
      mockRBACService.checkPermission.mockRejectedValue(new Error('RBAC Service error'));

      const app = new Elysia()
        .use(createTestAuthMiddleware())
        .use(requirePermission('events', PermissionAction.READ))
        .get('/events', () => ({ events: [] }));

      const response = await app.handle(new Request('https://localhost/events'));

      expect(response.status).toBe(403);
    });

    it('should log unauthorized access attempts', async () => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient permissions'
      });

      const app = new Elysia()
        .use(createTestAuthMiddleware())
        .use(requirePermission('admin', PermissionAction.READ))
        .get('/admin', () => ({ message: 'admin panel' }));

      const response = await app.handle(new Request('https://localhost/admin'));

      expect(response.status).toBe(403);
      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'MEDIUM',
          userId: 'user-123',
          ipAddress: '192.168.1.100',
          userAgent: 'test-agent/1.0'
        })
      });
    });

    it('should handle missing user data in context', async () => {
      const app = new Elysia()
        .use(createTestAuthMiddleware({ user: null, isAuthenticated: false }))
        .use(requirePermission('events', PermissionAction.READ))
        .get('/events', () => ({ events: [] }));

      const response = await app.handle(new Request('https://localhost/events'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should handle async condition functions in conditionalPermission', async () => {
      mockRBACService.checkPermission.mockResolvedValue({
        allowed: true,
        reason: 'Permission granted'
      });

      const asyncCondition = jest.fn().mockResolvedValue(true);
      const conditions = [
        {
          condition: asyncCondition,
          resource: 'events',
          action: PermissionAction.READ
        }
      ];

      const app = new Elysia()
        .use(createTestAuthMiddleware())
        .use(conditionalPermission(conditions))
        .get('/test', () => ({ message: 'success' }));

      const response = await app.handle(new Request('https://localhost/test'));

      expect(response.status).toBe(200);
      expect(asyncCondition).toHaveBeenCalled();
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
        .use(createTestAuthMiddleware({ params: { id: 'event-123' } }))
        .use(requirePermission('events', PermissionAction.UPDATE, {
          resourceIdFromParam: 'id'
        }))
        .put('/events/:id', (context) => {
          capturedContext = context;
          return { message: 'success' };
        });

      const response = await app.handle(new Request('https://localhost/events/event-123', {
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
