import { describe, expect, it, beforeEach } from '@jest/globals';
import { Elysia } from 'elysia';
import { rbacRoutes } from '../../../routes/rbac.js';

// Mock de los controladores de RBAC
const mockRbacController = {
  getRoles: jest.fn(),
  getPermissions: jest.fn(),
  getUserPermissions: jest.fn(),
  assignUserRole: jest.fn(),
  revokeUserRole: jest.fn(),
  grantUserPermission: jest.fn(),
  revokeUserPermission: jest.fn(),
  getUsersWithRoles: jest.fn(),
  checkUserPermission: jest.fn(),
  getRBACStats: jest.fn(),
  initializePermissions: jest.fn()
};

jest.mock('../../../controllers/rbacController.js', () => mockRbacController);

// Mock de los middlewares de autenticación y autorización
const mockAuthMiddleware = jest.fn();
const mockRequireAuth = jest.fn();
const mockRequireAdminAccess = jest.fn();
const mockRequireModeratorAccess = jest.fn();
const mockRequireUserManagementPermission = jest.fn();
const mockRequireRoles = jest.fn();

jest.mock('../../../middleware/auth.js', () => ({
  requireAuth: new (require('elysia').Elysia)().derive(() => ({
    user: { 
      id: 'user-123', 
      name: 'Test User', 
      email: 'test@example.com', 
      role: 'ADMIN' 
    },
    isAuthenticated: true
  }))
}));

jest.mock('../../../middleware/rbacMiddleware.js', () => ({
  requireAdminAccess: new (require('elysia').Elysia)().derive(() => ({
    hasAdminAccess: true
  })),
  requireModeratorAccess: new (require('elysia').Elysia)().derive(() => ({
    hasModeratorAccess: true
  })),
  requireUserManagementPermission: () => new (require('elysia').Elysia)().derive(() => ({
    hasUserManagementPermission: true
  })),
  requireRoles: (roles: string[]) => new (require('elysia').Elysia)().derive(() => ({
    hasRequiredRoles: true,
    requiredRoles: roles
  }))
}));

describe('🔐 RBAC Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new Elysia().use(rbacRoutes);
  });

  describe('GET /rbac/my-permissions', () => {
    const mockMyPermissions = {
      success: true,
      data: {
        userId: 'user-123',
        roles: ['CLIENT', 'MODERATOR'],
        permissions: [
          {
            id: '1',
            action: 'READ_EVENTS',
            resource: 'events',
            granted: true,
            source: 'role'
          },
          {
            id: '2',
            action: 'CREATE_POSTS',
            resource: 'forum',
            granted: true,
            source: 'role'
          },
          {
            id: '3',
            action: 'MANAGE_USERS',
            resource: 'users',
            granted: false,
            source: 'none'
          }
        ],
        effective: {
          canRead: ['events', 'forum', 'news'],
          canWrite: ['forum'],
          canManage: []
        }
      },
      message: 'User permissions retrieved successfully'
    };

    it('should get current user permissions successfully', async () => {
      mockRbacController.getUserPermissions.mockResolvedValue(mockMyPermissions);

      const response = await app.handle(new Request('http://localhost/rbac/my-permissions'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockMyPermissions);
      expect(responseBody.data.userId).toBe('user-123');
      expect(responseBody.data.permissions).toHaveLength(3);
      expect(responseBody.data.effective.canRead).toContain('events');
      expect(mockRbacController.getUserPermissions).toHaveBeenCalledWith({
        params: { userId: 'user-123' }
      });
    });

    it('should handle user without permissions', async () => {
      const emptyPermissions = {
        success: true,
        data: {
          userId: 'user-123',
          roles: ['CLIENT'],
          permissions: [],
          effective: { canRead: [], canWrite: [], canManage: [] }
        },
        message: 'User has no additional permissions'
      };

      mockRbacController.getUserPermissions.mockResolvedValue(emptyPermissions);

      const response = await app.handle(new Request('http://localhost/rbac/my-permissions'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.permissions).toHaveLength(0);
      expect(responseBody.data.effective.canRead).toHaveLength(0);
    });

    it('should handle permissions retrieval errors', async () => {
      mockRbacController.getUserPermissions.mockRejectedValue(
        new Error('User not found')
      );

      const response = await app.handle(new Request('http://localhost/rbac/my-permissions'));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /rbac/roles', () => {
    const mockRoles = {
      success: true,
      data: {
        roles: [
          {
            id: 1,
            name: 'CLIENT',
            description: 'Regular user with basic permissions',
            level: 1,
            isActive: true,
            permissions: ['READ_EVENTS', 'READ_NEWS']
          },
          {
            id: 2,
            name: 'MODERATOR',
            description: 'User with moderation capabilities',
            level: 2,
            isActive: true,
            permissions: ['READ_EVENTS', 'READ_NEWS', 'MODERATE_FORUM', 'CREATE_POSTS']
          },
          {
            id: 3,
            name: 'ADMIN',
            description: 'Administrator with full access',
            level: 3,
            isActive: true,
            permissions: ['*']
          }
        ],
        total: 3
      },
      message: 'Roles retrieved successfully'
    };

    it('should get all roles successfully', async () => {
      mockRbacController.getRoles.mockResolvedValue(mockRoles);

      const response = await app.handle(new Request('http://localhost/rbac/roles'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockRoles);
      expect(responseBody.data.roles).toHaveLength(3);
      expect(responseBody.data.roles[2].name).toBe('ADMIN');
      expect(responseBody.data.roles[2].permissions).toContain('*');
      expect(mockRbacController.getRoles).toHaveBeenCalledTimes(1);
    });

    it('should handle empty roles list', async () => {
      const emptyRoles = {
        success: true,
        data: { roles: [], total: 0 },
        message: 'No roles defined'
      };

      mockRbacController.getRoles.mockResolvedValue(emptyRoles);

      const response = await app.handle(new Request('http://localhost/rbac/roles'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.roles).toHaveLength(0);
      expect(responseBody.data.total).toBe(0);
    });
  });

  describe('GET /rbac/permissions', () => {
    const mockPermissions = {
      success: true,
      data: {
        permissions: [
          {
            id: 1,
            action: 'READ_EVENTS',
            resource: 'events',
            description: 'Can view events',
            category: 'read'
          },
          {
            id: 2,
            action: 'CREATE_POSTS',
            resource: 'forum',
            description: 'Can create forum posts',
            category: 'write'
          },
          {
            id: 3,
            action: 'MANAGE_USERS',
            resource: 'users',
            description: 'Can manage user accounts',
            category: 'admin'
          },
          {
            id: 4,
            action: 'DELETE_EVENTS',
            resource: 'events',
            description: 'Can delete events',
            category: 'admin'
          }
        ],
        categories: ['read', 'write', 'admin'],
        total: 4
      },
      message: 'Permissions retrieved successfully'
    };

    it('should get all permissions successfully', async () => {
      mockRbacController.getPermissions.mockResolvedValue(mockPermissions);

      const response = await app.handle(new Request('http://localhost/rbac/permissions'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockPermissions);
      expect(responseBody.data.permissions).toHaveLength(4);
      expect(responseBody.data.categories).toContain('admin');
      expect(responseBody.data.total).toBe(4);
      expect(mockRbacController.getPermissions).toHaveBeenCalledTimes(1);
    });

    it('should handle permissions grouped by category', async () => {
      const response = await app.handle(new Request('http://localhost/rbac/permissions'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      const readPerms = responseBody.data.permissions.filter((p: any) => p.category === 'read');
      const adminPerms = responseBody.data.permissions.filter((p: any) => p.category === 'admin');
      
      expect(readPerms.length).toBeGreaterThan(0);
      expect(adminPerms.length).toBeGreaterThan(0);
    });
  });

  describe('GET /rbac/users', () => {
    const mockUsersWithRoles = {
      success: true,
      data: {
        users: [
          {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com',
            roles: ['CLIENT'],
            isActive: true,
            lastLogin: '2024-01-15T10:00:00Z'
          },
          {
            id: 'user-2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            roles: ['MODERATOR'],
            isActive: true,
            lastLogin: '2024-01-15T09:30:00Z'
          },
          {
            id: 'user-3',
            name: 'Admin User',
            email: 'admin@example.com',
            roles: ['ADMIN'],
            isActive: true,
            lastLogin: '2024-01-15T08:00:00Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
          totalPages: 1
        },
        filters: {
          role: null,
          isActive: null
        }
      },
      message: 'Users with roles retrieved successfully'
    };

    it('should get users with roles successfully', async () => {
      mockRbacController.getUsersWithRoles.mockResolvedValue(mockUsersWithRoles);

      const response = await app.handle(new Request('http://localhost/rbac/users'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockUsersWithRoles);
      expect(responseBody.data.users).toHaveLength(3);
      expect(responseBody.data.users[2].roles).toContain('ADMIN');
      expect(mockRbacController.getUsersWithRoles).toHaveBeenCalledWith({ query: {} });
    });

    it('should handle filtered users by role', async () => {
      const filteredUsers = {
        ...mockUsersWithRoles,
        data: {
          ...mockUsersWithRoles.data,
          users: [mockUsersWithRoles.data.users[1]], // Only moderator
          filters: { role: 'MODERATOR', isActive: null }
        }
      };

      mockRbacController.getUsersWithRoles.mockResolvedValue(filteredUsers);

      const response = await app.handle(new Request('http://localhost/rbac/users?role=MODERATOR'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.users).toHaveLength(1);
      expect(responseBody.data.users[0].roles).toContain('MODERATOR');
      expect(responseBody.data.filters.role).toBe('MODERATOR');
    });

    it('should handle pagination parameters', async () => {
      mockRbacController.getUsersWithRoles.mockResolvedValue(mockUsersWithRoles);

      const response = await app.handle(new Request('http://localhost/rbac/users?page=1&limit=5'));

      expect(response.status).toBe(200);
      
      expect(mockRbacController.getUsersWithRoles).toHaveBeenCalledWith({
        query: { page: '1', limit: '5' }
      });
    });
  });

  describe('GET /rbac/stats', () => {
    const mockRbacStats = {
      success: true,
      data: {
        totalUsers: 125,
        totalRoles: 4,
        totalPermissions: 24,
        usersByRole: {
          CLIENT: 95,
          MODERATOR: 18,
          ADMIN: 10,
          SUPER_ADMIN: 2
        },
        activeUsers: 118,
        inactiveUsers: 7,
        recentActivity: {
          roleAssignments: {
            last24h: 3,
            lastWeek: 15,
            lastMonth: 45
          },
          permissionChanges: {
            last24h: 1,
            lastWeek: 8,
            lastMonth: 22
          }
        },
        systemHealth: {
          orphanedPermissions: 0,
          duplicateRoles: 0,
          inconsistentUsers: 0
        }
      },
      message: 'RBAC statistics retrieved successfully'
    };

    it('should get RBAC statistics successfully', async () => {
      mockRbacController.getRBACStats.mockResolvedValue(mockRbacStats);

      const response = await app.handle(new Request('http://localhost/rbac/stats'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockRbacStats);
      expect(responseBody.data.totalUsers).toBe(125);
      expect(responseBody.data.usersByRole.CLIENT).toBe(95);
      expect(responseBody.data.systemHealth.orphanedPermissions).toBe(0);
      expect(mockRbacController.getRBACStats).toHaveBeenCalledTimes(1);
    });

    it('should handle stats with system issues', async () => {
      const statsWithIssues = {
        ...mockRbacStats,
        data: {
          ...mockRbacStats.data,
          systemHealth: {
            orphanedPermissions: 3,
            duplicateRoles: 1,
            inconsistentUsers: 2
          }
        }
      };

      mockRbacController.getRBACStats.mockResolvedValue(statsWithIssues);

      const response = await app.handle(new Request('http://localhost/rbac/stats'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.systemHealth.orphanedPermissions).toBe(3);
      expect(responseBody.data.systemHealth.duplicateRoles).toBe(1);
      expect(responseBody.data.systemHealth.inconsistentUsers).toBe(2);
    });
  });

  describe('POST /rbac/users/:userId/check-permission', () => {
    const mockPermissionCheck = {
      success: true,
      data: {
        userId: 'user-456',
        hasPermission: true,
        permission: {
          action: 'CREATE_POSTS',
          resource: 'forum'
        },
        grantedBy: ['MODERATOR'],
        source: 'role'
      },
      message: 'Permission check completed'
    };

    it('should check user permission successfully', async () => {
      mockRbacController.checkUserPermission.mockResolvedValue(mockPermissionCheck);

      const requestBody = {
        action: 'CREATE_POSTS',
        resource: 'forum'
      };

      const response = await app.handle(new Request('http://localhost/rbac/users/user-456/check-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockPermissionCheck);
      expect(responseBody.data.hasPermission).toBe(true);
      expect(responseBody.data.grantedBy).toContain('MODERATOR');
      expect(mockRbacController.checkUserPermission).toHaveBeenCalledWith({
        params: { userId: 'user-456' },
        body: requestBody
      });
    });

    it('should handle permission denied', async () => {
      const permissionDenied = {
        success: true,
        data: {
          userId: 'user-456',
          hasPermission: false,
          permission: {
            action: 'DELETE_EVENTS',
            resource: 'events'
          },
          grantedBy: [],
          source: 'none'
        },
        message: 'Permission denied'
      };

      mockRbacController.checkUserPermission.mockResolvedValue(permissionDenied);

      const response = await app.handle(new Request('http://localhost/rbac/users/user-456/check-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_EVENTS', resource: 'events' })
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.hasPermission).toBe(false);
      expect(responseBody.data.grantedBy).toHaveLength(0);
    });
  });

  describe('GET /rbac/users/:userId/permissions', () => {
    const mockUserPermissions = {
      success: true,
      data: {
        userId: 'user-789',
        name: 'Target User',
        roles: ['CLIENT', 'MODERATOR'],
        permissions: [
          {
            id: '1',
            action: 'CREATE_POSTS',
            resource: 'forum',
            granted: true,
            source: 'role',
            grantedBy: 'MODERATOR'
          },
          {
            id: '2',
            action: 'MANAGE_EVENTS',
            resource: 'events',
            granted: true,
            source: 'direct',
            grantedBy: 'admin-user'
          }
        ],
        effective: {
          canRead: ['events', 'forum', 'news'],
          canWrite: ['forum'],
          canManage: ['events']
        }
      },
      message: 'User permissions retrieved successfully'
    };

    it('should get specific user permissions (admin access)', async () => {
      mockRbacController.getUserPermissions.mockResolvedValue(mockUserPermissions);

      const response = await app.handle(new Request('http://localhost/rbac/users/user-789/permissions'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockUserPermissions);
      expect(responseBody.data.userId).toBe('user-789');
      expect(responseBody.data.permissions).toHaveLength(2);
      expect(responseBody.data.effective.canManage).toContain('events');
      expect(mockRbacController.getUserPermissions).toHaveBeenCalledWith({
        params: { userId: 'user-789' }
      });
    });

    it('should handle non-existent user', async () => {
      mockRbacController.getUserPermissions.mockRejectedValue(
        new Error('User not found')
      );

      const response = await app.handle(new Request('http://localhost/rbac/users/nonexistent/permissions'));

      expect(response.status).toBe(500);
    });
  });

  describe('POST /rbac/users/:userId/roles', () => {
    const mockRoleAssignment = {
      success: true,
      data: {
        userId: 'user-456',
        assignedRole: 'MODERATOR',
        currentRoles: ['CLIENT', 'MODERATOR'],
        assignedBy: 'admin-123',
        assignedAt: '2024-01-15T14:00:00Z'
      },
      message: 'Role assigned successfully'
    };

    it('should assign role to user successfully', async () => {
      mockRbacController.assignUserRole.mockResolvedValue(mockRoleAssignment);

      const requestBody = {
        roleName: 'MODERATOR'
      };

      const response = await app.handle(new Request('http://localhost/rbac/users/user-456/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockRoleAssignment);
      expect(responseBody.data.assignedRole).toBe('MODERATOR');
      expect(responseBody.data.currentRoles).toContain('MODERATOR');
      expect(mockRbacController.assignUserRole).toHaveBeenCalledWith({
        params: { userId: 'user-456' },
        body: requestBody,
        user: expect.objectContaining({ id: 'user-123' })
      });
    });

    it('should handle duplicate role assignment', async () => {
      mockRbacController.assignUserRole.mockRejectedValue(
        new Error('User already has this role')
      );

      const response = await app.handle(new Request('http://localhost/rbac/users/user-456/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName: 'CLIENT' })
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /rbac/users/:userId/roles', () => {
    const mockRoleRevocation = {
      success: true,
      data: {
        userId: 'user-456',
        revokedRole: 'MODERATOR',
        currentRoles: ['CLIENT'],
        revokedBy: 'admin-123',
        revokedAt: '2024-01-15T14:30:00Z'
      },
      message: 'Role revoked successfully'
    };

    it('should revoke role from user successfully', async () => {
      mockRbacController.revokeUserRole.mockResolvedValue(mockRoleRevocation);

      const requestBody = {
        roleName: 'MODERATOR'
      };

      const response = await app.handle(new Request('http://localhost/rbac/users/user-456/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockRoleRevocation);
      expect(responseBody.data.revokedRole).toBe('MODERATOR');
      expect(responseBody.data.currentRoles).not.toContain('MODERATOR');
      expect(mockRbacController.revokeUserRole).toHaveBeenCalledWith({
        params: { userId: 'user-456' },
        body: requestBody,
        user: expect.objectContaining({ id: 'user-123' })
      });
    });

    it('should handle non-existent role revocation', async () => {
      mockRbacController.revokeUserRole.mockRejectedValue(
        new Error('User does not have this role')
      );

      const response = await app.handle(new Request('http://localhost/rbac/users/user-456/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName: 'ADMIN' })
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('POST /rbac/users/:userId/permissions', () => {
    const mockPermissionGrant = {
      success: true,
      data: {
        userId: 'user-456',
        grantedPermission: {
          action: 'MANAGE_EVENTS',
          resource: 'events'
        },
        grantedBy: 'admin-123',
        grantedAt: '2024-01-15T15:00:00Z',
        source: 'direct'
      },
      message: 'Permission granted successfully'
    };

    it('should grant permission to user successfully', async () => {
      mockRbacController.grantUserPermission.mockResolvedValue(mockPermissionGrant);

      const requestBody = {
        action: 'MANAGE_EVENTS',
        resource: 'events'
      };

      const response = await app.handle(new Request('http://localhost/rbac/users/user-456/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockPermissionGrant);
      expect(responseBody.data.grantedPermission.action).toBe('MANAGE_EVENTS');
      expect(responseBody.data.source).toBe('direct');
      expect(mockRbacController.grantUserPermission).toHaveBeenCalledWith({
        params: { userId: 'user-456' },
        body: requestBody,
        user: expect.objectContaining({ id: 'user-123' })
      });
    });
  });

  describe('DELETE /rbac/users/:userId/permissions', () => {
    const mockPermissionRevoke = {
      success: true,
      data: {
        userId: 'user-456',
        revokedPermission: {
          action: 'MANAGE_EVENTS',
          resource: 'events'
        },
        revokedBy: 'admin-123',
        revokedAt: '2024-01-15T15:30:00Z'
      },
      message: 'Permission revoked successfully'
    };

    it('should revoke permission from user successfully', async () => {
      mockRbacController.revokeUserPermission.mockResolvedValue(mockPermissionRevoke);

      const requestBody = {
        action: 'MANAGE_EVENTS',
        resource: 'events'
      };

      const response = await app.handle(new Request('http://localhost/rbac/users/user-456/permissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockPermissionRevoke);
      expect(responseBody.data.revokedPermission.action).toBe('MANAGE_EVENTS');
      expect(mockRbacController.revokeUserPermission).toHaveBeenCalledWith({
        params: { userId: 'user-456' },
        body: requestBody,
        user: expect.objectContaining({ id: 'user-123' })
      });
    });
  });

  describe('POST /rbac/initialize', () => {
    const mockInitialization = {
      success: true,
      data: {
        initializedBy: 'super-admin-123',
        initializedAt: '2024-01-15T16:00:00Z',
        created: {
          roles: 4,
          permissions: 24,
          userAssignments: 3
        },
        updated: {
          roles: 1,
          permissions: 2
        },
        systemStatus: 'initialized'
      },
      message: 'RBAC system initialized successfully'
    };

    it('should initialize RBAC system successfully (super admin)', async () => {
      mockRbacController.initializePermissions.mockResolvedValue(mockInitialization);

      const response = await app.handle(new Request('http://localhost/rbac/initialize', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockInitialization);
      expect(responseBody.data.created.roles).toBe(4);
      expect(responseBody.data.created.permissions).toBe(24);
      expect(responseBody.data.systemStatus).toBe('initialized');
      expect(mockRbacController.initializePermissions).toHaveBeenCalledWith({
        user: expect.objectContaining({ id: 'user-123' })
      });
    });

    it('should handle already initialized system', async () => {
      mockRbacController.initializePermissions.mockResolvedValue({
        success: false,
        message: 'System already initialized',
        data: { systemStatus: 'already_initialized' }
      });

      const response = await app.handle(new Request('http://localhost/rbac/initialize', {
        method: 'POST'
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toBe('System already initialized');
    });

    it('should handle initialization errors', async () => {
      mockRbacController.initializePermissions.mockRejectedValue(
        new Error('Failed to initialize system')
      );

      const response = await app.handle(new Request('http://localhost/rbac/initialize', {
        method: 'POST'
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('Route Integration and Security', () => {
    it('should handle all RBAC endpoints with proper authentication', async () => {
      const endpoints = [
        { path: '/rbac/my-permissions', method: 'GET' },
        { path: '/rbac/roles', method: 'GET' },
        { path: '/rbac/permissions', method: 'GET' },
        { path: '/rbac/users', method: 'GET' },
        { path: '/rbac/stats', method: 'GET' }
      ];

      for (const endpoint of endpoints) {
        // Mock all controllers to return success
        Object.values(mockRbacController).forEach(mock => {
          (mock as jest.Mock).mockResolvedValue({ success: true, data: {} });
        });

        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: endpoint.method
          })
        );

        expect(response.status).not.toBe(404);
        expect(response.status).not.toBe(401);
      }
    });

    it('should handle POST/DELETE endpoints with request bodies', async () => {
      const postEndpoints = [
        { path: '/rbac/users/test-user/check-permission', body: { action: 'READ_EVENTS', resource: 'events' } },
        { path: '/rbac/users/test-user/roles', body: { roleName: 'CLIENT' } },
        { path: '/rbac/users/test-user/permissions', body: { action: 'CREATE_POSTS', resource: 'forum' } }
      ];

      const deleteEndpoints = [
        { path: '/rbac/users/test-user/roles', body: { roleName: 'MODERATOR' } },
        { path: '/rbac/users/test-user/permissions', body: { action: 'MANAGE_EVENTS', resource: 'events' } }
      ];

      Object.values(mockRbacController).forEach(mock => {
        (mock as jest.Mock).mockResolvedValue({ success: true, data: {} });
      });

      for (const endpoint of postEndpoints) {
        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(endpoint.body)
          })
        );

        expect(response.status).not.toBe(404);
      }

      for (const endpoint of deleteEndpoints) {
        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(endpoint.body)
          })
        );

        expect(response.status).not.toBe(404);
      }
    });

    it('should provide user context to controllers', async () => {
      mockRbacController.assignUserRole.mockImplementation(({ user }) => {
        expect(user.id).toBe('user-123');
        expect(user.role).toBe('ADMIN');
        return Promise.resolve({ success: true, data: {} });
      });

      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName: 'CLIENT' })
      }));

      expect(response.status).toBe(200);
    });

    it('should handle malformed request bodies gracefully', async () => {
      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/check-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      }));

      expect(response.status).not.toBe(200);
    });

    it('should handle concurrent RBAC requests', async () => {
      Object.values(mockRbacController).forEach(mock => {
        (mock as jest.Mock).mockResolvedValue({ success: true, data: {} });
      });

      const requests = [
        app.handle(new Request('http://localhost/rbac/my-permissions')),
        app.handle(new Request('http://localhost/rbac/roles')),
        app.handle(new Request('http://localhost/rbac/stats'))
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should provide consistent response format across all endpoints', async () => {
      const mockResponse = {
        success: true,
        data: { test: 'data' },
        message: 'Test response'
      };

      const endpoints = ['/rbac/roles', '/rbac/permissions', '/rbac/stats'];

      for (const endpoint of endpoints) {
        (mockRbacController.getRoles as jest.Mock).mockResolvedValue(mockResponse);
        (mockRbacController.getPermissions as jest.Mock).mockResolvedValue(mockResponse);
        (mockRbacController.getRBACStats as jest.Mock).mockResolvedValue(mockResponse);

        const response = await app.handle(new Request(`http://localhost${endpoint}`));
        
        expect(response.status).toBe(200);
        
        const responseBody = await response.json();
        expect(responseBody).toHaveProperty('success');
        expect(responseBody).toHaveProperty('data');
        expect(responseBody).toHaveProperty('message');
      }
    });

    it('should handle parameter validation in routes', async () => {
      // Test with various user ID formats
      const userIds = ['user-123', 'invalid-id', '12345', 'user@test.com'];

      for (const userId of userIds) {
        mockRbacController.getUserPermissions.mockResolvedValue({ success: true, data: {} });

        const response = await app.handle(
          new Request(`http://localhost/rbac/users/${encodeURIComponent(userId)}/permissions`)
        );

        // Should handle all formats gracefully (controller decides validation)
        expect(response.status).toBe(200);
        expect(mockRbacController.getUserPermissions).toHaveBeenCalledWith({
          params: { userId }
        });
      }
    });

    it('should handle role hierarchy and permission inheritance', async () => {
      const hierarchyTest = {
        success: true,
        data: {
          roles: ['CLIENT', 'MODERATOR', 'ADMIN'],
          permissions: {
            inherited: ['READ_EVENTS', 'CREATE_POSTS'],
            direct: ['MANAGE_EVENTS'],
            effective: ['READ_EVENTS', 'CREATE_POSTS', 'MANAGE_EVENTS']
          }
        }
      };

      mockRbacController.getUserPermissions.mockResolvedValue(hierarchyTest);

      const response = await app.handle(new Request('http://localhost/rbac/my-permissions'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data.permissions.effective).toContain('READ_EVENTS');
      expect(responseBody.data.permissions.effective).toContain('MANAGE_EVENTS');
    });
  });
});