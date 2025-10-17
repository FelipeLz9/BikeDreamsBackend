import { RBACService, ROLE_HIERARCHY } from '../services/rbacService';
import { prisma } from '../prisma/client';
import { Role, PermissionAction } from '@prisma/client';

/**
 * Obtener todos los roles disponibles y sus capacidades
 */
export const getRoles = async () => {
  try {
    const roles = Object.values(ROLE_HIERARCHY).map(roleInfo => ({
      role: roleInfo.role,
      description: roleInfo.description,
      level: roleInfo.level,
      permissionCount: roleInfo.permissions.length,
      permissions: roleInfo.permissions
    }));

    return {
      success: true,
      roles: roles.sort((a, b) => b.level - a.level) // Ordenar por nivel descendente
    };
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    return {
      success: false,
      error: 'Error obteniendo roles del sistema'
    };
  }
};

/**
 * Obtener todos los permisos disponibles
 */
export const getPermissions = async () => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }]
    });

    // Agrupar por recurso
    const groupedPermissions = permissions.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push({
        id: perm.id,
        name: perm.name,
        action: perm.action,
        description: perm.description
      });
      return acc;
    }, {} as Record<string, any[]>);

    return {
      success: true,
      permissions: groupedPermissions,
      total: permissions.length
    };
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    return {
      success: false,
      error: 'Error obteniendo permisos del sistema'
    };
  }
};

/**
 * Obtener permisos efectivos de un usuario
 */
export const getUserPermissions = async ({ params }: { params: { userId: string } }) => {
  try {
    const { userId } = params;
    
    const result = await RBACService.getUserEffectivePermissions(userId);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      user: result.user,
      permissions: result.permissions,
      roles: result.roles,
      permissionCount: result.permissions?.length || 0
    };

  } catch (error) {
    console.error('Error obteniendo permisos de usuario:', error);
    return {
      success: false,
      error: 'Error obteniendo permisos del usuario'
    };
  }
};

/**
 * Asignar rol a usuario
 */
export const assignUserRole = async ({ 
  params, 
  body, 
  user 
}: { 
  params: { userId: string }; 
  body: { role: Role; expiresAt?: string }; 
  user: any; 
}) => {
  try {
    const { userId } = params;
    const { role, expiresAt } = body;

    if (!role || !Object.values(Role).includes(role)) {
      return {
        success: false,
        error: 'Rol inválido'
      };
    }

    // Verificar que el usuario actual puede asignar este rol
    const canManage = await RBACService.canManageUser(user.id, userId);
    if (!canManage) {
      return {
        success: false,
        error: 'No tienes permisos para asignar roles a este usuario'
      };
    }

    // Verificar que el rol a asignar no sea superior al del usuario actual
    const safeUserRole = (Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, user.role)
      ? user.role
      : 'GUEST') as Role;
    const currentUserLevel = ROLE_HIERARCHY[safeUserRole]?.level || 0;
    const targetRoleLevel = ROLE_HIERARCHY[role]?.level || 0;
    
    if (targetRoleLevel >= currentUserLevel) {
      return {
        success: false,
        error: 'No puedes asignar un rol de nivel superior o igual al tuyo'
      };
    }

    const expirationDate = expiresAt ? new Date(expiresAt) : undefined;
    
    const result = await RBACService.assignRole(userId, role, user.id, expirationDate);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      message: `Rol ${role} asignado correctamente`,
      assignment: result.assignment
    };

  } catch (error) {
    console.error('Error asignando rol:', error);
    return {
      success: false,
      error: 'Error asignando rol al usuario'
    };
  }
};

/**
 * Revocar rol de usuario
 */
export const revokeUserRole = async ({ 
  params, 
  body, 
  user 
}: { 
  params: { userId: string }; 
  body: { role: Role }; 
  user: any; 
}) => {
  try {
    const { userId } = params;
    const { role } = body;

    if (!role || !Object.values(Role).includes(role)) {
      return {
        success: false,
        error: 'Rol inválido'
      };
    }

    // Verificar permisos
    const canManage = await RBACService.canManageUser(user.id, userId);
    if (!canManage) {
      return {
        success: false,
        error: 'No tienes permisos para revocar roles a este usuario'
      };
    }

    const result = await RBACService.revokeRole(userId, role, user.id);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      message: `Rol ${role} revocado correctamente`
    };

  } catch (error) {
    console.error('Error revocando rol:', error);
    return {
      success: false,
      error: 'Error revocando rol del usuario'
    };
  }
};

/**
 * Otorgar permiso específico a usuario
 */
export const grantUserPermission = async ({ 
  params, 
  body, 
  user 
}: { 
  params: { userId: string }; 
  body: { permissionId: string; expiresAt?: string }; 
  user: any; 
}) => {
  try {
    const { userId } = params;
    const { permissionId, expiresAt } = body;

    if (!permissionId) {
      return {
        success: false,
        error: 'ID de permiso requerido'
      };
    }

    // Verificar que el permiso existe
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId }
    });

    if (!permission) {
      return {
        success: false,
        error: 'Permiso no encontrado'
      };
    }

    // Verificar permisos para gestionar usuario
    const canManage = await RBACService.canManageUser(user.id, userId);
    if (!canManage) {
      return {
        success: false,
        error: 'No tienes permisos para otorgar permisos a este usuario'
      };
    }

    const expirationDate = expiresAt ? new Date(expiresAt) : undefined;
    
    const result = await RBACService.grantUserPermission(userId, permissionId, user.id, expirationDate);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      message: `Permiso ${permission.name} otorgado correctamente`,
      userPermission: result.userPermission
    };

  } catch (error) {
    console.error('Error otorgando permiso:', error);
    return {
      success: false,
      error: 'Error otorgando permiso al usuario'
    };
  }
};

/**
 * Revocar permiso específico de usuario
 */
export const revokeUserPermission = async ({ 
  params, 
  body, 
  user 
}: { 
  params: { userId: string }; 
  body: { permissionId: string }; 
  user: any; 
}) => {
  try {
    const { userId } = params;
    const { permissionId } = body;

    if (!permissionId) {
      return {
        success: false,
        error: 'ID de permiso requerido'
      };
    }

    // Verificar permisos para gestionar usuario
    const canManage = await RBACService.canManageUser(user.id, userId);
    if (!canManage) {
      return {
        success: false,
        error: 'No tienes permisos para revocar permisos a este usuario'
      };
    }

    const result = await RBACService.revokeUserPermission(userId, permissionId, user.id);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      message: 'Permiso revocado correctamente'
    };

  } catch (error) {
    console.error('Error revocando permiso:', error);
    return {
      success: false,
      error: 'Error revocando permiso del usuario'
    };
  }
};

/**
 * Obtener usuarios con sus roles y permisos
 */
export const getUsersWithRoles = async ({ 
  query 
}: { 
  query: { page?: string; limit?: string; search?: string; role?: string } 
}) => {
  try {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const roleFilter = query.role as Role;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (roleFilter && Object.values(Role).includes(roleFilter)) {
      where.role = roleFilter;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          roleAssignments: {
            where: {
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            },
            select: {
              role: true,
              expiresAt: true,
              assignedBy: true,
              createdAt: true
            }
          },
          userPermissions: {
            where: {
              granted: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            },
            include: {
              permission: {
                select: {
                  name: true,
                  resource: true,
                  action: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const usersWithMetadata = users.map(user => {
      const roleInfo = ROLE_HIERARCHY[user.role];
      const additionalRoles = user.roleAssignments.map(ra => ra.role);
      const directPermissions = user.userPermissions.map(up => up.permission.name);
      
      return {
        ...user,
        roleInfo: {
          level: roleInfo?.level || 0,
          description: roleInfo?.description || 'Rol desconocido'
        },
        additionalRoles,
        directPermissions,
        totalPermissions: (roleInfo?.permissions?.length || 0) + directPermissions.length
      };
    });

    return {
      success: true,
      users: usersWithMetadata,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

  } catch (error) {
    console.error('Error obteniendo usuarios con roles:', error);
    return {
      success: false,
      error: 'Error obteniendo usuarios'
    };
  }
};

/**
 * Verificar permisos específicos de un usuario
 */
export const checkUserPermission = async ({ 
  params, 
  body 
}: { 
  params: { userId: string }; 
  body: { resource: string; action: PermissionAction; resourceId?: string } 
}) => {
  try {
    const { userId } = params;
    const { resource, action, resourceId } = body;

    if (!resource || !action) {
      return {
        success: false,
        error: 'Recurso y acción son requeridos'
      };
    }

    const result = await RBACService.checkPermission({
      userId,
      resource,
      action,
      resourceId
    });

    return {
      success: true,
      allowed: result.allowed,
      reason: result.reason,
      matchedPermission: result.matchedPermission,
      appliedPolicy: result.appliedPolicy
    };

  } catch (error) {
    console.error('Error verificando permiso:', error);
    return {
      success: false,
      error: 'Error verificando permiso'
    };
  }
};

/**
 * Obtener estadísticas del sistema RBAC
 */
export const getRBACStats = async () => {
  try {
    const [
      totalUsers,
      totalPermissions,
      activeRoleAssignments,
      activeUserPermissions,
      usersByRole
    ] = await Promise.all([
      prisma.user.count(),
      prisma.permission.count(),
      prisma.roleAssignment.count({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }),
      prisma.userPermission.count({
        where: {
          granted: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
        orderBy: { _count: { role: 'desc' } }
      })
    ]);

    const roleDistribution = usersByRole.map(item => ({
      role: item.role,
      count: item._count.role,
      description: ROLE_HIERARCHY[item.role]?.description || 'Desconocido'
    }));

    return {
      success: true,
      stats: {
        totalUsers,
        totalPermissions,
        activeRoleAssignments,
        activeUserPermissions,
        roleDistribution,
        availableRoles: Object.keys(ROLE_HIERARCHY).length
      }
    };

  } catch (error) {
    console.error('Error obteniendo estadísticas RBAC:', error);
    return {
      success: false,
      error: 'Error obteniendo estadísticas'
    };
  }
};

/**
 * Inicializar permisos del sistema
 */
export const initializePermissions = async ({ user }: { user: any }) => {
  try {
    // Solo super admin puede inicializar permisos
    if (user.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Solo el super administrador puede inicializar permisos'
      };
    }

    const result = await RBACService.initializeDefaultPermissions();
    
    return {
      success: result.success,
      message: result.success ? 'Permisos inicializados correctamente' : 'Error inicializando permisos',
      error: result.success ? undefined : result.error
    };

  } catch (error) {
    console.error('Error inicializando permisos:', error);
    return {
      success: false,
      error: 'Error inicializando permisos del sistema'
    };
  }
};
