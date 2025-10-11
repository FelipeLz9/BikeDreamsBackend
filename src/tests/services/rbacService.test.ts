// Mock de las dependencias problemáticas antes de importar el servicio
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
    userPermission: {
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    roleAssignment: {
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    rolePermission: {
      findFirst: jest.fn(),
    },
    resourcePolicy: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    }
  }
}));

import { RBACService, PermissionCheck } from '../../services/rbacService';
import { Role, PermissionAction } from '@prisma/client';

describe('🔐 RBAC Service Tests', () => {
  const { prisma } = require('../../prisma/client');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkPermission', () => {
    test('should allow access with valid user permissions', async () => {
      const mockUser = {
        id: '1',
        role: 'CLIENT' as Role,
        isActive: true,
        userPermissions: [
          {
            granted: true,
            expiresAt: null,
            permission: {
              resource: 'events',
              action: 'READ' as PermissionAction
            }
          }
        ],
        roleAssignments: []
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const check: PermissionCheck = {
        userId: '1',
        resource: 'events',
        action: 'READ' as PermissionAction
      };

      const result = await RBACService.checkPermission(check);

      expect(result.allowed).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          userPermissions: {
            include: { permission: true },
            where: {
              granted: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: expect.any(Date) } }
              ]
            }
          },
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

    test('should deny access for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const check: PermissionCheck = {
        userId: 'non-existent',
        resource: 'events',
        action: 'READ' as PermissionAction
      };

      const result = await RBACService.checkPermission(check);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Usuario no encontrado');
    });

    test('should deny access for inactive user', async () => {
      const mockUser = {
        id: '1',
        role: 'CLIENT' as Role,
        isActive: false,
        userPermissions: [],
        roleAssignments: []
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const check: PermissionCheck = {
        userId: '1',
        resource: 'events',
        action: 'READ' as PermissionAction
      };

      const result = await RBACService.checkPermission(check);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Usuario inactivo');
    });

    test('should allow access based on role permissions', async () => {
      const mockUser = {
        id: '1',
        role: 'ADMIN' as Role,
        isActive: true,
        userPermissions: [], // Sin permisos directos
        roleAssignments: []
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const check: PermissionCheck = {
        userId: '1',
        resource: 'users',
        action: 'READ' as PermissionAction
      };

      const result = await RBACService.checkPermission(check);

      expect(result.allowed).toBe(true);
    });

    test('should allow SUPER_ADMIN access to everything', async () => {
      const mockUser = {
        id: '1',
        role: 'SUPER_ADMIN' as Role,
        isActive: true,
        userPermissions: [],
        roleAssignments: []
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const check: PermissionCheck = {
        userId: '1',
        resource: 'any-resource',
        action: 'DELETE' as PermissionAction
      };

      const result = await RBACService.checkPermission(check);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Super administrador tiene acceso completo');
    });

    test('should deny access and log security event', async () => {
      const mockUser = {
        id: '1',
        role: 'CLIENT' as Role,
        isActive: true,
        userPermissions: [],
        roleAssignments: []
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.auditLog.create.mockResolvedValue({});
      prisma.securityEvent.create.mockResolvedValue({});

      const check: PermissionCheck = {
        userId: '1',
        resource: 'admin',
        action: 'DELETE' as PermissionAction
      };

      const result = await RBACService.checkPermission(check);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Acceso denegado');
      expect(prisma.securityEvent.create).toHaveBeenCalled();
    });

    test('should check additional role assignments', async () => {
      const mockUser = {
        id: '1',
        role: 'CLIENT' as Role,
        isActive: true,
        userPermissions: [],
        roleAssignments: [
          {
            role: 'MODERATOR' as Role,
            isActive: true,
            expiresAt: null
          }
        ]
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const check: PermissionCheck = {
        userId: '1',
        resource: 'events',
        action: 'READ' as PermissionAction // More basic permission
      };

      const result = await RBACService.checkPermission(check);

      expect(result.allowed).toBe(true);
    });
  });

  describe('assignRole', () => {
    test('should assign role successfully', async () => {
      prisma.roleAssignment.upsert.mockResolvedValue({
        id: 'assignment-1',
        userId: '1',
        role: 'MODERATOR',
        isActive: true
      });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await RBACService.assignRole('1', 'MODERATOR' as Role, 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.roleAssignment.upsert).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    test('should handle database errors gracefully in assignRole', async () => {
      prisma.roleAssignment.upsert.mockRejectedValue(new Error('Database error'));

      const result = await RBACService.assignRole('1', 'MODERATOR' as Role, 'admin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error asignando rol');
    });
  });

  describe('grantUserPermission', () => {
    test('should grant user permission successfully', async () => {
      prisma.userPermission.upsert.mockResolvedValue({
        id: 'user-perm-1',
        userId: '1',
        permissionId: 'perm-1',
        granted: true
      });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await RBACService.grantUserPermission('1', 'perm-1', 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.userPermission.upsert).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      prisma.userPermission.upsert.mockRejectedValue(new Error('Database error'));

      const result = await RBACService.grantUserPermission('1', 'perm-1', 'admin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error otorgando permiso');
    });
  });

  describe('revokeRole', () => {
    test('should revoke role successfully', async () => {
      prisma.roleAssignment.updateMany.mockResolvedValue({ count: 1 });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await RBACService.revokeRole('1', 'MODERATOR' as Role, 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.roleAssignment.updateMany).toHaveBeenCalledWith({
        where: { userId: '1', role: 'MODERATOR' },
        data: { isActive: false, updatedAt: expect.any(Date) }
      });
    });

    test('should handle database errors gracefully', async () => {
      prisma.roleAssignment.updateMany.mockRejectedValue(new Error('Database error'));

      const result = await RBACService.revokeRole('1', 'MODERATOR' as Role, 'admin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error revocando rol');
    });
  });

  describe('revokeUserPermission', () => {
    test('should revoke user permission successfully', async () => {
      prisma.userPermission.updateMany.mockResolvedValue({ count: 1 });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await RBACService.revokeUserPermission('1', 'perm-1', 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.userPermission.updateMany).toHaveBeenCalledWith({
        where: { userId: '1', permissionId: 'perm-1' },
        data: { granted: false, updatedAt: expect.any(Date) }
      });
    });

    test('should handle database errors gracefully', async () => {
      prisma.userPermission.updateMany.mockRejectedValue(new Error('Database error'));

      const result = await RBACService.revokeUserPermission('1', 'perm-1', 'admin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error revocando permiso');
    });
  });

  describe('canManageUser', () => {
    test('should allow higher role to manage lower role', async () => {
      const mockManager = { id: 'manager-1', role: 'ADMIN' };
      const mockTarget = { id: 'target-1', role: 'CLIENT' };
      
      prisma.user.findUnique.mockImplementation((query) => {
        if (query.where.id === 'manager-1') return mockManager;
        if (query.where.id === 'target-1') return mockTarget;
        return null;
      });

      const canManage = await RBACService.canManageUser('manager-1', 'target-1');

      expect(canManage).toBe(true);
    });

    test('should not allow lower role to manage higher role', async () => {
      const mockManager = { id: 'manager-1', role: 'CLIENT' };
      const mockTarget = { id: 'target-1', role: 'ADMIN' };
      
      prisma.user.findUnique.mockImplementation((query) => {
        if (query.where.id === 'manager-1') return mockManager;
        if (query.where.id === 'target-1') return mockTarget;
        return null;
      });

      const canManage = await RBACService.canManageUser('manager-1', 'target-1');

      expect(canManage).toBe(false);
    });

    test('should not allow same role to manage itself', async () => {
      const mockManager = { id: 'manager-1', role: 'ADMIN' };
      const mockTarget = { id: 'target-1', role: 'ADMIN' };
      
      prisma.user.findUnique.mockImplementation((query) => {
        if (query.where.id === 'manager-1') return mockManager;
        if (query.where.id === 'target-1') return mockTarget;
        return null;
      });

      const canManage = await RBACService.canManageUser('manager-1', 'target-1');

      expect(canManage).toBe(false);
    });

    test('should allow SUPER_ADMIN to manage anyone', async () => {
      const mockManager = { id: 'manager-1', role: 'SUPER_ADMIN' };
      const mockTarget = { id: 'target-1', role: 'ADMIN' };
      
      prisma.user.findUnique.mockImplementation((query) => {
        if (query.where.id === 'manager-1') return mockManager;
        if (query.where.id === 'target-1') return mockTarget;
        return null;
      });

      const canManage = await RBACService.canManageUser('manager-1', 'target-1');

      expect(canManage).toBe(true);
    });

    test('should return false for non-existent users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const canManage = await RBACService.canManageUser('non-existent', 'target-1');

      expect(canManage).toBe(false);
    });
  });

  describe('getUserEffectivePermissions', () => {
    test('should return combined permissions from role and direct assignments', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'CLIENT' as Role,
        isActive: true,
        userPermissions: [
          {
            granted: true,
            expiresAt: null,
            permission: { resource: 'events', action: 'UPDATE' }
          }
        ],
        roleAssignments: [
          {
            role: 'MODERATOR' as Role,
            isActive: true,
            expiresAt: null
          }
        ]
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await RBACService.getUserEffectivePermissions('1');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('1');
      expect(result.user.role).toBe('CLIENT');
      expect(result.permissions).toBeDefined();
      expect(result.permissions.length).toBeGreaterThan(0);
      expect(result.roles).toContain('CLIENT');
      expect(result.roles).toContain('MODERATOR');
      
      // Should include direct permission
      expect(result.permissions).toContain('events.update');
      // Should include CLIENT role permissions
      expect(result.permissions).toContain('events.read');
    });

    test('should fail for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await RBACService.getUserEffectivePermissions('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Usuario no encontrado');
    });

    test('should handle database errors gracefully', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await RBACService.getUserEffectivePermissions('1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error obteniendo permisos');
    });
  });

  describe('error handling', () => {
    test('should handle database errors gracefully in checkPermission', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const check: PermissionCheck = {
        userId: '1',
        resource: 'events',
        action: 'READ' as PermissionAction
      };

      const result = await RBACService.checkPermission(check);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Error interno');
    });

    test('should handle database errors gracefully in assignRole', async () => {
      prisma.roleAssignment.upsert.mockRejectedValue(new Error('Database error'));

      const result = await RBACService.assignRole('1', 'MODERATOR' as Role, 'admin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error asignando rol');
    });

    test('should handle database errors gracefully in grantUserPermission', async () => {
      prisma.userPermission.upsert.mockRejectedValue(new Error('Database error'));

      const result = await RBACService.grantUserPermission('1', 'perm-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error otorgando permiso');
    });
  });

  // TODO: Re-enable resource policies tests after fixing policy structure
  // describe('resource policies', () => {
  //   test('should check resource-specific policies', async () => {
  //     const mockUser = {
  //       id: '1',
  //       role: 'CLIENT' as Role,
  //       isActive: true,
  //       userPermissions: [],
  //       roleAssignments: []
  //     };
  //
  //     const mockPolicies = [
  //       {
  //         resource: 'events',
  //         resourceId: 'event-1',
  //         userId: '1',
  //         effect: 'ALLOW',
  //         policy: { actions: ['READ', 'UPDATE'] }
  //       }
  //     ];
  //
  //     prisma.user.findUnique.mockResolvedValue(mockUser);
  //     prisma.resourcePolicy.findMany.mockResolvedValue(mockPolicies);
  //
  //     const check: PermissionCheck = {
  //       userId: '1',
  //       resource: 'events',
  //       action: 'UPDATE' as PermissionAction,
  //       resourceId: 'event-1'
  //     };
  //
  //     const result = await RBACService.checkPermission(check);
  //
  //     expect(result.allowed).toBe(true);
  //     expect(result.reason).toContain('Política de recurso');
  //   });
  // });
});
