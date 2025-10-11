import { prisma } from '../prisma/client.js';
import { Role, PermissionAction, PolicyEffect, LogSeverity, SecurityEventType } from '@prisma/client';

// Interfaces
export interface PermissionCheck {
  userId: string;
  resource: string;
  action: PermissionAction;
  resourceId?: string;
  context?: any;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  matchedPermission?: any;
  appliedPolicy?: any;
}

export interface RoleCapabilities {
  role: Role;
  permissions: string[];
  description: string;
  level: number;
}

// Definición de capacidades por rol
const ROLE_HIERARCHY: Record<Role, RoleCapabilities> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    permissions: ['*'],
    description: 'Acceso completo al sistema',
    level: 100
  },
  ADMIN: {
    role: 'ADMIN',
    permissions: [
      'users.read', 'users.update', 'users.delete', 'users.manage',
      'events.read', 'events.create', 'events.update', 'events.delete', 'events.manage',
      'news.read', 'news.create', 'news.update', 'news.delete', 'news.moderate',
      'forum.read', 'forum.moderate', 'forum.manage',
      'donations.read', 'donations.manage',
      'admin.read', 'admin.execute'
    ],
    description: 'Administrador general con amplios permisos',
    level: 90
  },
  MODERATOR: {
    role: 'MODERATOR',
    permissions: [
      'users.read',
      'events.read', 'events.moderate',
      'news.read', 'news.moderate',
      'forum.read', 'forum.moderate',
      'donations.read'
    ],
    description: 'Moderador de contenido',
    level: 70
  },
  EDITOR: {
    role: 'EDITOR',
    permissions: [
      'events.read', 'events.create', 'events.update',
      'news.read', 'news.create', 'news.update',
      'forum.read', 'forum.create', 'forum.update'
    ],
    description: 'Editor de contenido',
    level: 60
  },
  EVENT_MANAGER: {
    role: 'EVENT_MANAGER',
    permissions: [
      'events.read', 'events.create', 'events.update', 'events.manage',
      'news.read',
      'forum.read'
    ],
    description: 'Gestor especializado en eventos',
    level: 50
  },
  USER_MANAGER: {
    role: 'USER_MANAGER',
    permissions: [
      'users.read', 'users.update', 'users.manage',
      'events.read',
      'news.read',
      'forum.read', 'forum.moderate'
    ],
    description: 'Gestor especializado en usuarios',
    level: 50
  },
  VIEWER: {
    role: 'VIEWER',
    permissions: [
      'events.read',
      'news.read',
      'forum.read',
      'donations.read'
    ],
    description: 'Acceso de solo lectura avanzada',
    level: 30
  },
  CLIENT: {
    role: 'CLIENT',
    permissions: [
      'events.read',
      'news.read',
      'forum.read', 'forum.create',
      'donations.create'
    ],
    description: 'Usuario estándar',
    level: 20
  },
  GUEST: {
    role: 'GUEST',
    permissions: [
      'events.read',
      'news.read'
    ],
    description: 'Invitado con acceso muy limitado',
    level: 10
  }
};

export class RBACService {
  /**
   * Verificar si un usuario tiene permisos para una acción específica
   */
  static async checkPermission(check: PermissionCheck): Promise<PermissionResult> {
    try {
      const { userId, resource, action, resourceId, context } = check;

      // Obtener usuario con todas sus relaciones RBAC
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userPermissions: {
            include: { permission: true },
            where: {
              granted: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          },
          roleAssignments: {
            where: {
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          }
        }
      });

      if (!user) {
        return { allowed: false, reason: 'Usuario no encontrado' };
      }

      if (!user.isActive) {
        return { allowed: false, reason: 'Usuario inactivo' };
      }

      // 1. Verificar permisos directos del usuario
      const userPermissionResult = await this.checkUserPermissions(user, resource, action);
      if (userPermissionResult.allowed) {
        return userPermissionResult;
      }

      // 2. Verificar permisos por rol principal
      const rolePermissionResult = await this.checkRolePermissions(user.role, resource, action);
      if (rolePermissionResult.allowed) {
        return rolePermissionResult;
      }

      // 3. Verificar roles adicionales asignados
      for (const roleAssignment of user.roleAssignments) {
        const additionalRoleResult = await this.checkRolePermissions(roleAssignment.role, resource, action);
        if (additionalRoleResult.allowed) {
          return additionalRoleResult;
        }
      }

      // 4. Verificar políticas de recursos específicos
      if (resourceId) {
        const policyResult = await this.checkResourcePolicies(user, resource, resourceId, action, context);
        if (policyResult.allowed) {
          return policyResult;
        }
      }

      // Log de acceso denegado
      await this.logAccessDenied(userId, resource, action, resourceId);

      return { 
        allowed: false, 
        reason: `Acceso denegado: no tienes permisos para ${action} en ${resource}` 
      };

    } catch (error) {
      console.error('Error verificando permisos:', error);
      return { allowed: false, reason: 'Error interno verificando permisos' };
    }
  }

  /**
   * Verificar permisos directos del usuario
   */
  private static async checkUserPermissions(user: any, resource: string, action: PermissionAction): Promise<PermissionResult> {
    const userPermission = user.userPermissions.find((up: any) => {
      const perm = up.permission;
      return perm.resource === resource && perm.action === action && up.granted;
    });

    if (userPermission) {
      return {
        allowed: true,
        reason: 'Permiso directo de usuario',
        matchedPermission: userPermission
      };
    }

    return { allowed: false };
  }

  /**
   * Verificar permisos por rol
   */
  private static async checkRolePermissions(role: Role, resource: string, action: PermissionAction): Promise<PermissionResult> {
    // Verificar super admin
    if (role === 'SUPER_ADMIN') {
      return {
        allowed: true,
        reason: 'Super administrador tiene acceso completo'
      };
    }

    // Verificar capacidades del rol
    const capabilities = ROLE_HIERARCHY[role];
    if (!capabilities) {
      return { allowed: false };
    }

    // Verificar permisos wildcard
    if (capabilities.permissions.includes('*')) {
      return {
        allowed: true,
        reason: `Rol ${role} tiene acceso completo`
      };
    }

    // Verificar permisos específicos
    const requiredPermission = `${resource}.${action.toLowerCase()}`;
    if (capabilities.permissions.includes(requiredPermission)) {
      return {
        allowed: true,
        reason: `Rol ${role} tiene permiso ${requiredPermission}`
      };
    }

    // Verificar permisos de la base de datos
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: role,
        granted: true,
        permission: {
          resource: resource,
          action: action
        }
      },
      include: { permission: true }
    });

    if (rolePermission) {
      return {
        allowed: true,
        reason: `Rol ${role} tiene permiso en base de datos`,
        matchedPermission: rolePermission
      };
    }

    return { allowed: false };
  }

  /**
   * Verificar políticas de recursos específicos
   */
  private static async checkResourcePolicies(
    user: any, 
    resource: string, 
    resourceId: string, 
    action: PermissionAction,
    context?: any
  ): Promise<PermissionResult> {
    const policies = await prisma.resourcePolicy.findMany({
      where: {
        resource: resource,
        OR: [
          { resourceId: resourceId },
          { resourceId: null } // Políticas generales
        ],
        isActive: true
      },
      orderBy: { priority: 'desc' }
    });

    for (const policy of policies) {
      const evaluation = this.evaluatePolicy(policy, user, action, context);
      if (evaluation.matches) {
        return {
          allowed: evaluation.effect === 'ALLOW',
          reason: `Política de recurso: ${evaluation.effect}`,
          appliedPolicy: policy
        };
      }
    }

    return { allowed: false };
  }

  /**
   * Evaluar una política específica
   */
  private static evaluatePolicy(policy: any, user: any, action: PermissionAction, context?: any) {
    try {
      const policyData = policy.policy as any;
      const conditions = policy.conditions as any;

      // Evaluación básica de política
      if (policyData.actions && !policyData.actions.includes(action)) {
        return { matches: false };
      }

      if (policyData.roles && !policyData.roles.includes(user.role)) {
        return { matches: false };
      }

      if (policyData.users && !policyData.users.includes(user.id)) {
        return { matches: false };
      }

      // Evaluación de condiciones
      if (conditions) {
        if (conditions.timeRange) {
          const now = new Date();
          const start = new Date(conditions.timeRange.start);
          const end = new Date(conditions.timeRange.end);
          if (now < start || now > end) {
            return { matches: false };
          }
        }

        if (conditions.ipRange && context?.ipAddress) {
          // Implementar lógica de rango IP si es necesario
        }
      }

      return { 
        matches: true, 
        effect: policy.effect 
      };

    } catch (error) {
      console.error('Error evaluando política:', error);
      return { matches: false };
    }
  }

  /**
   * Asignar rol a usuario
   */
  static async assignRole(
    userId: string, 
    role: Role, 
    assignedBy: string,
    expiresAt?: Date
  ) {
    try {
      const assignment = await prisma.roleAssignment.upsert({
        where: {
          userId_role: { userId, role }
        },
        update: {
          isActive: true,
          expiresAt,
          assignedBy,
          updatedAt: new Date()
        },
        create: {
          userId,
          role,
          assignedBy,
          expiresAt,
          isActive: true
        }
      });

      // Log de auditoría
      await this.logRoleAssignment(userId, role, assignedBy, 'ASSIGNED');

      return { success: true, assignment };
    } catch (error) {
      console.error('Error asignando rol:', error);
      return { success: false, error: 'Error asignando rol' };
    }
  }

  /**
   * Revocar rol de usuario
   */
  static async revokeRole(userId: string, role: Role, revokedBy: string) {
    try {
      await prisma.roleAssignment.updateMany({
        where: { userId, role },
        data: { isActive: false, updatedAt: new Date() }
      });

      // Log de auditoría
      await this.logRoleAssignment(userId, role, revokedBy, 'REVOKED');

      return { success: true };
    } catch (error) {
      console.error('Error revocando rol:', error);
      return { success: false, error: 'Error revocando rol' };
    }
  }

  /**
   * Otorgar permiso específico a usuario
   */
  static async grantUserPermission(
    userId: string,
    permissionId: string,
    grantedBy: string,
    expiresAt?: Date
  ) {
    try {
      const userPermission = await prisma.userPermission.upsert({
        where: {
          userId_permissionId: { userId, permissionId }
        },
        update: {
          granted: true,
          expiresAt,
          grantedBy,
          updatedAt: new Date()
        },
        create: {
          userId,
          permissionId,
          granted: true,
          grantedBy,
          expiresAt
        }
      });

      // Log de auditoría
      await this.logPermissionGrant(userId, permissionId, grantedBy, 'GRANTED');

      return { success: true, userPermission };
    } catch (error) {
      console.error('Error otorgando permiso:', error);
      return { success: false, error: 'Error otorgando permiso' };
    }
  }

  /**
   * Revocar permiso específico de usuario
   */
  static async revokeUserPermission(userId: string, permissionId: string, revokedBy: string) {
    try {
      await prisma.userPermission.updateMany({
        where: { userId, permissionId },
        data: { granted: false, updatedAt: new Date() }
      });

      // Log de auditoría
      await this.logPermissionGrant(userId, permissionId, revokedBy, 'REVOKED');

      return { success: true };
    } catch (error) {
      console.error('Error revocando permiso:', error);
      return { success: false, error: 'Error revocando permiso' };
    }
  }

  /**
   * Obtener todos los permisos efectivos de un usuario
   */
  static async getUserEffectivePermissions(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userPermissions: {
            include: { permission: true },
            where: {
              granted: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          },
          roleAssignments: {
            where: {
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            }
          }
        }
      });

      if (!user) {
        return { success: false, error: 'Usuario no encontrado' };
      }

      const permissions = new Set<string>();

      // Permisos directos
      user.userPermissions.forEach(up => {
        const perm = up.permission;
        permissions.add(`${perm.resource}.${perm.action.toLowerCase()}`);
      });

      // Permisos por rol principal
      const mainRoleCapabilities = ROLE_HIERARCHY[user.role];
      if (mainRoleCapabilities) {
        mainRoleCapabilities.permissions.forEach(p => permissions.add(p));
      }

      // Permisos por roles adicionales
      for (const roleAssignment of user.roleAssignments) {
        const roleCapabilities = ROLE_HIERARCHY[roleAssignment.role];
        if (roleCapabilities) {
          roleCapabilities.permissions.forEach(p => permissions.add(p));
        }
      }

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        },
        permissions: Array.from(permissions).sort(),
        roles: [user.role, ...user.roleAssignments.map(ra => ra.role)]
      };

    } catch (error) {
      console.error('Error obteniendo permisos efectivos:', error);
      return { success: false, error: 'Error obteniendo permisos' };
    }
  }

  /**
   * Verificar si un usuario puede realizar una acción sobre otro usuario
   */
  static async canManageUser(managerId: string, targetUserId: string): Promise<boolean> {
    try {
      const manager = await prisma.user.findUnique({ where: { id: managerId } });
      const target = await prisma.user.findUnique({ where: { id: targetUserId } });

      if (!manager || !target) return false;

      const managerLevel = ROLE_HIERARCHY[manager.role]?.level || 0;
      const targetLevel = ROLE_HIERARCHY[target.role]?.level || 0;

      // Solo se puede gestionar usuarios de nivel inferior
      return managerLevel > targetLevel;
    } catch (error) {
      return false;
    }
  }

  /**
   * Inicializar permisos por defecto del sistema
   */
  static async initializeDefaultPermissions() {
    try {
      const resources = ['users', 'events', 'news', 'forum', 'donations', 'admin'];
      const actions = Object.values(PermissionAction);

      for (const resource of resources) {
        for (const action of actions) {
          await prisma.permission.upsert({
            where: {
              resource_action: { resource, action }
            },
            update: {},
            create: {
              name: `${resource}.${action.toLowerCase()}`,
              resource,
              action,
              description: `Permiso para ${action} en ${resource}`
            }
          });
        }
      }

      console.log('✅ Permisos por defecto inicializados');
      return { success: true };
    } catch (error) {
      console.error('Error inicializando permisos:', error);
      return { success: false, error };
    }
  }

  /**
   * Logging de eventos de seguridad
   */
  private static async logAccessDenied(
    userId: string, 
    resource: string, 
    action: PermissionAction, 
    resourceId?: string
  ) {
    try {
      await prisma.securityEvent.create({
        data: {
          eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
          severity: LogSeverity.MEDIUM,
          description: `Acceso denegado: usuario ${userId} intentó ${action} en ${resource}`,
          userId: userId,
          metadata: {
            resource,
            action,
            resourceId
          }
        }
      });
    } catch (error) {
      console.error('Error logging access denied:', error);
    }
  }

  private static async logRoleAssignment(
    userId: string,
    role: Role,
    performedBy: string,
    action: 'ASSIGNED' | 'REVOKED'
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: performedBy,
          action: `ROLE_${action}`,
          resource: 'User',
          resourceId: userId,
          success: true,
          severity: LogSeverity.INFO,
          details: { targetUser: userId, role, action }
        }
      });
    } catch (error) {
      console.error('Error logging role assignment:', error);
    }
  }

  private static async logPermissionGrant(
    userId: string,
    permissionId: string,
    performedBy: string,
    action: 'GRANTED' | 'REVOKED'
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: performedBy,
          action: `PERMISSION_${action}`,
          resource: 'UserPermission',
          resourceId: permissionId,
          success: true,
          severity: LogSeverity.INFO,
          details: { targetUser: userId, permissionId, action }
        }
      });
    } catch (error) {
      console.error('Error logging permission grant:', error);
    }
  }
}

// Exportar constantes útiles
export { ROLE_HIERARCHY };
