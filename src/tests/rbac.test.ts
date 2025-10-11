import { RBACService, ROLE_HIERARCHY } from '../services/rbacService';
import { prisma } from '../prisma/client';
import { Role, PermissionAction } from '@prisma/client';

// Mock Prisma para tests
jest.mock('../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn()
    },
    permission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn()
    },
    rolePermission: {
      findFirst: jest.fn()
    },
    roleAssignment: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn()
    },
    userPermission: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn()
    },
    resourcePolicy: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    securityEvent: {
      create: jest.fn()
    }
  }
}));

describe('🔐 RBAC Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Hierarchy', () => {
    test('Should have all required roles defined', () => {
      const expectedRoles = [
        'SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'EDITOR', 
        'EVENT_MANAGER', 'USER_MANAGER', 'VIEWER', 'CLIENT', 'GUEST'
      ];
      
      const definedRoles = Object.keys(ROLE_HIERARCHY);
      expect(definedRoles).toEqual(expect.arrayContaining(expectedRoles));
      expect(definedRoles.length).toBe(9);
    });

    test('Should have proper role hierarchy levels', () => {
      expect(ROLE_HIERARCHY.SUPER_ADMIN.level).toBe(100);
      expect(ROLE_HIERARCHY.ADMIN.level).toBe(90);
      expect(ROLE_HIERARCHY.MODERATOR.level).toBe(70);
      expect(ROLE_HIERARCHY.CLIENT.level).toBe(20);
      expect(ROLE_HIERARCHY.GUEST.level).toBe(10);
    });

    test('Super Admin should have wildcard permissions', () => {
      expect(ROLE_HIERARCHY.SUPER_ADMIN.permissions).toContain('*');
    });

    test('Roles should have appropriate permissions', () => {
      expect(ROLE_HIERARCHY.EVENT_MANAGER.permissions).toContain('events.manage');
      expect(ROLE_HIERARCHY.USER_MANAGER.permissions).toContain('users.manage');
      expect(ROLE_HIERARCHY.CLIENT.permissions).toContain('events.read');
      expect(ROLE_HIERARCHY.GUEST.permissions).not.toContain('users.read');
    });
  });

  describe('Permission Checking', () => {
    test('Should allow Super Admin access to everything', async () => {
      const mockUser = {
        id: 'user-1',
        role: Role.SUPER_ADMIN,
        isActive: true,
        userPermissions: [],
        roleAssignments: []
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await RBACService.checkPermission({
        userId: 'user-1',
        resource: 'any-resource',
        action: PermissionAction.DELETE
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Super administrador');
    });

    test('Should deny access for inactive user', async () => {
      const mockUser = {
        id: 'user-1',
        role: Role.CLIENT,
        isActive: false,
        userPermissions: [],
        roleAssignments: []
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await RBACService.checkPermission({
        userId: 'user-1',
        resource: 'events',
        action: PermissionAction.READ
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Usuario inactivo');
    });

    test('Should allow access based on role permissions', async () => {
      const mockUser = {
        id: 'user-1',
        role: Role.EVENT_MANAGER,
        isActive: true,
        userPermissions: [],
        roleAssignments: []
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await RBACService.checkPermission({
        userId: 'user-1',
        resource: 'events',
        action: PermissionAction.MANAGE
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('events.manage');
    });

    test('Should deny access for insufficient role permissions', async () => {
      const mockUser = {
        id: 'user-1',
        role: Role.CLIENT,
        isActive: true,
        userPermissions: [],
        roleAssignments: []
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.rolePermission.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await RBACService.checkPermission({
        userId: 'user-1',
        resource: 'admin',
        action: PermissionAction.EXECUTE
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('no tienes permisos');
    });

    test('Should allow access with direct user permission', async () => {
      const mockUser = {
        id: 'user-1',
        role: Role.CLIENT,
        isActive: true,
        userPermissions: [{
          granted: true,
          permission: {
            resource: 'events',
            action: PermissionAction.UPDATE
          }
        }],
        roleAssignments: []
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await RBACService.checkPermission({
        userId: 'user-1',
        resource: 'events',
        action: PermissionAction.UPDATE
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Permiso directo de usuario');
    });
  });

  describe('Role Assignment', () => {
    test('Should successfully assign role', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        userId: 'user-1',
        role: Role.MODERATOR,
        isActive: true
      };

      (prisma.roleAssignment.upsert as jest.Mock).mockResolvedValue(mockAssignment);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await RBACService.assignRole('user-1', Role.MODERATOR, 'admin-1');

      expect(result.success).toBe(true);
      expect(result.assignment).toEqual(mockAssignment);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    test('Should revoke role successfully', async () => {
      (prisma.roleAssignment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await RBACService.revokeRole('user-1', Role.MODERATOR, 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.roleAssignment.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', role: Role.MODERATOR },
        data: { isActive: false, updatedAt: expect.any(Date) }
      });
    });
  });

  describe('User Permission Management', () => {
    test('Should grant user permission successfully', async () => {
      const mockUserPermission = {
        id: 'permission-1',
        userId: 'user-1',
        permissionId: 'perm-1',
        granted: true
      };

      (prisma.userPermission.upsert as jest.Mock).mockResolvedValue(mockUserPermission);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await RBACService.grantUserPermission('user-1', 'perm-1', 'admin-1');

      expect(result.success).toBe(true);
      expect(result.userPermission).toEqual(mockUserPermission);
    });

    test('Should revoke user permission successfully', async () => {
      (prisma.userPermission.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await RBACService.revokeUserPermission('user-1', 'perm-1', 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.userPermission.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', permissionId: 'perm-1' },
        data: { granted: false, updatedAt: expect.any(Date) }
      });
    });
  });

  describe('Effective Permissions', () => {
    test('Should get user effective permissions', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: Role.ADMIN,
        isActive: true,
        userPermissions: [{
          permission: {
            resource: 'special',
            action: PermissionAction.EXECUTE
          }
        }],
        roleAssignments: [{
          role: Role.MODERATOR
        }]
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await RBACService.getUserEffectivePermissions('user-1');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.permissions).toContain('special.execute');
      expect(result.roles).toContain(Role.ADMIN);
      expect(result.roles).toContain(Role.MODERATOR);
    });
  });

  describe('User Management Hierarchy', () => {
    test('Should allow admin to manage lower level user', async () => {
      const adminUser = { id: 'admin-1', role: Role.ADMIN };
      const clientUser = { id: 'client-1', role: Role.CLIENT };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(clientUser);

      const result = await RBACService.canManageUser('admin-1', 'client-1');

      expect(result).toBe(true);
    });

    test('Should prevent lower level user from managing higher level', async () => {
      const clientUser = { id: 'client-1', role: Role.CLIENT };
      const adminUser = { id: 'admin-1', role: Role.ADMIN };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(clientUser)
        .mockResolvedValueOnce(adminUser);

      const result = await RBACService.canManageUser('client-1', 'admin-1');

      expect(result).toBe(false);
    });

    test('Should prevent same level management', async () => {
      const admin1 = { id: 'admin-1', role: Role.ADMIN };
      const admin2 = { id: 'admin-2', role: Role.ADMIN };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(admin1)
        .mockResolvedValueOnce(admin2);

      const result = await RBACService.canManageUser('admin-1', 'admin-2');

      expect(result).toBe(false);
    });
  });

  describe('Permission Initialization', () => {
    test('Should initialize default permissions', async () => {
      (prisma.permission.upsert as jest.Mock).mockResolvedValue({
        id: 'perm-1',
        name: 'events.read',
        resource: 'events',
        action: PermissionAction.READ
      });

      const result = await RBACService.initializeDefaultPermissions();

      expect(result.success).toBe(true);
      
      // Verificar que se llamó upsert para cada combinación resource/action
      const expectedResources = ['users', 'events', 'news', 'forum', 'donations', 'admin'];
      const expectedActions = Object.values(PermissionAction);
      const expectedCalls = expectedResources.length * expectedActions.length;
      
      expect(prisma.permission.upsert).toHaveBeenCalledTimes(expectedCalls);
    });
  });
});

console.log('🔐 RBAC Tests configurados correctamente');
