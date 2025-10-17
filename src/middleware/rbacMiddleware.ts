import { Elysia } from 'elysia';
import { RBACService, PermissionCheck } from '../services/rbacService';
import { PermissionAction, Role, SecurityEventType, LogSeverity } from '@prisma/client';
import { authMiddleware } from './auth';
import { prisma } from '../prisma/client';

/**
 * Middleware que requiere permiso específico para un recurso
 */
export const requirePermission = (
  resource: string, 
  action: PermissionAction,
  options: {
    resourceIdFromParam?: string;
    resourceIdFromBody?: string;
    allowResourceOwner?: boolean;
    customCheck?: (context: any) => Promise<boolean>;
  } = {}
) => {
  return new Elysia()
    .use(authMiddleware)
    .onBeforeHandle(async (context: any) => {
      const { user, isAuthenticated, clientIp, userAgent, params, body, set, path } = context;

      if (!isAuthenticated || !user) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Autenticación requerida'
        };
      }

      // Extraer resourceId si se especifica
      let resourceId: string | undefined;
      if (options.resourceIdFromParam) {
        resourceId = params[options.resourceIdFromParam];
      } else if (options.resourceIdFromBody) {
        resourceId = body?.[options.resourceIdFromBody];
      }

      // Verificar si es el propietario del recurso
      if (options.allowResourceOwner && resourceId) {
        const isOwner = await checkResourceOwnership(user.id, resource, resourceId);
        if (isOwner) {
          return; // Permitir acceso si es el propietario
        }
      }

      // Verificación personalizada
      if (options.customCheck) {
        const customResult = await options.customCheck(context);
        if (customResult) {
          return;
        }
      }

      // Verificar permisos RBAC
      const permissionCheck: PermissionCheck = {
        userId: user.id,
        resource,
        action,
        resourceId,
        context: {
          ipAddress: clientIp,
          userAgent,
          requestPath: context.path
        }
      };

      const result = await RBACService.checkPermission(permissionCheck);

      if (!result.allowed) {
        await logUnauthorizedAccess(user.id, resource, action, clientIp, userAgent, result.reason);
        set.status = 403;
        return {
          error: 'Forbidden',
          message: result.reason || 'Insufficient permissions'
        };
      }

      // Agregar información de permisos al contexto para uso posterior
      context.permissionContext = {
        resource,
        action,
        resourceId,
        permissionResult: result
      };
    });
};

/**
 * Middleware que requiere uno o más roles específicos
 */
export const requireRoles = (roles: Role[]) => {
  return new Elysia()
    .use(authMiddleware)
    .onBeforeHandle(async (ctx: any) => {
      const { user, isAuthenticated, clientIp, userAgent, set } = ctx;
      if (!isAuthenticated || !user) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Autenticación requerida'
        };
      }

      // Verificar rol principal
      if (roles.includes(user.role)) {
        return;
      }

      // Verificar roles adicionales asignados
      const userWithRoles = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
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

      const hasRequiredRole = userWithRoles?.roleAssignments.some(ra => 
        roles.includes(ra.role)
      );

      if (!hasRequiredRole) {
        await logUnauthorizedAccess(
          user.id, 
          'role_check', 
          PermissionAction.READ, 
          clientIp, 
          userAgent,
          `Rol insuficiente. Requerido: ${roles.join('|')}, Actual: ${user.role}`
        );

        set.status = 403;
        return {
          error: 'Forbidden',
          message: `Acceso denegado. Roles requeridos: ${roles.join(', ')}`
        };
      }
    });
};

/**
 * Middleware que requiere nivel de rol mínimo
 */
export const requireMinRoleLevel = (minLevel: number) => {
  return new Elysia()
    .use(authMiddleware)
    .onBeforeHandle(async (ctx: any) => {
      const { user, isAuthenticated, clientIp, userAgent, set } = ctx;
      if (!isAuthenticated || !user) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Autenticación requerida'
        };
      }

      const userLevel = await getUserMaxLevel(user.id);
      
      if (userLevel < minLevel) {
        await logUnauthorizedAccess(
          user.id, 
          'level_check', 
          PermissionAction.READ, 
          clientIp, 
          userAgent,
          `Nivel insuficiente. Requerido: ${minLevel}, Actual: ${userLevel}`
        );

        set.status = 403;
        return {
          error: 'Forbidden',
          message: 'Nivel de autorización insuficiente'
        };
      }
    });
};

/**
 * Middleware que permite solo al propietario del recurso o usuarios con permisos
 */
export const requireResourceOwnershipOrPermission = (
  resource: string,
  action: PermissionAction,
  resourceIdParam: string
) => {
  return new Elysia()
    .use(authMiddleware)
    .onBeforeHandle(async (context: any) => {
      const { user, isAuthenticated, params, clientIp, userAgent, set } = context;

      if (!isAuthenticated || !user) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Autenticación requerida'
        };
      }

      const resourceId = params[resourceIdParam];
      if (!resourceId) {
        set.status = 400;
        return {
          error: 'Bad Request',
          message: 'ID de recurso requerido'
        };
      }

      // Verificar si es el propietario
      const isOwner = await checkResourceOwnership(user.id, resource, resourceId);
      if (isOwner) {
        return;
      }

      // Si no es propietario, verificar permisos
      const permissionCheck: PermissionCheck = {
        userId: user.id,
        resource,
        action,
        resourceId,
        context: { ipAddress: clientIp, userAgent }
      };

      const result = await RBACService.checkPermission(permissionCheck);

      if (!result.allowed) {
        await logUnauthorizedAccess(user.id, resource, action, clientIp, userAgent, 
          `No es propietario ni tiene permisos: ${result.reason}`);
        set.status = 403;
        return {
          error: 'Forbidden',
          message: 'Solo el propietario o usuarios autorizados pueden realizar esta acción'
        };
      }
    });
};

/**
 * Middleware para gestión de usuarios - solo permite gestionar usuarios de nivel inferior
 */
export const requireUserManagementPermission = () => {
  return new Elysia()
    .use(authMiddleware)
    .onBeforeHandle(async (ctx: any) => {
      const { user, isAuthenticated, params, clientIp, userAgent, set } = ctx;
      if (!isAuthenticated || !user) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Autenticación requerida'
        };
      }

      const targetUserId = params.userId || params.id;
      if (!targetUserId) {
        set.status = 400;
        return {
          error: 'Bad Request',
          message: 'ID de usuario requerido'
        };
      }

      // Verificar si puede gestionar el usuario objetivo
      const canManage = await RBACService.canManageUser(user.id, targetUserId);
      
      if (!canManage) {
        await logUnauthorizedAccess(
          user.id, 
          'user_management', 
          PermissionAction.MANAGE, 
          clientIp, 
          userAgent,
          `Intento de gestionar usuario de nivel superior: ${targetUserId}`
        );

        set.status = 403;
        return {
          error: 'Forbidden',
          message: 'No puedes gestionar usuarios de nivel superior o igual al tuyo'
        };
      }
    });
};

/**
 * Middleware condicional que aplica diferentes reglas según el contexto
 */
export const conditionalPermission = (
  conditions: Array<{
    condition: (context: any) => boolean | Promise<boolean>;
    resource: string;
    action: PermissionAction;
    message?: string;
  }>
) => {
  return new Elysia()
    .use(authMiddleware)
    .onBeforeHandle(async (context: any) => {
      const { user, isAuthenticated, clientIp, userAgent, set } = context;

      if (!isAuthenticated || !user) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Autenticación requerida'
        };
      }

      for (const rule of conditions) {
        const matches = await rule.condition(context);
        if (matches) {
          const permissionCheck: PermissionCheck = {
            userId: user.id,
            resource: rule.resource,
            action: rule.action,
            context: { ipAddress: clientIp, userAgent }
          };

          const result = await RBACService.checkPermission(permissionCheck);
          
          if (!result.allowed) {
            await logUnauthorizedAccess(user.id, rule.resource, rule.action, clientIp, userAgent, result.reason);

            set.status = 403;
            return {
              error: 'Forbidden',
              message: rule.message || result.reason || 'Insufficient permissions'
            };
          }

          break; // Solo aplicar la primera condición que coincida
        }
      }
    });
};

// Funciones auxiliares

/**
 * Verificar si un usuario es propietario de un recurso
 */
async function checkResourceOwnership(userId: string, resource: string, resourceId: string): Promise<boolean> {
  try {
    switch (resource) {
      case 'users':
        return userId === resourceId;
      
      case 'events':
        const event = await prisma.event.findUnique({ where: { id: resourceId } });
        // Los eventos no tienen propietario directo en el schema actual
        return false;
      
      case 'forum':
        const forumPost = await prisma.forumPost.findUnique({ where: { id: resourceId } });
        return forumPost?.userId === userId;
      
      case 'donations':
        const donation = await prisma.donation.findUnique({ where: { id: resourceId } });
        return donation?.userId === userId;
      
      default:
        return false;
    }
  } catch (error) {
    console.error('Error verificando propiedad de recurso:', error);
    return false;
  }
}

/**
 * Obtener el nivel máximo de rol de un usuario
 */
async function getUserMaxLevel(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
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

    if (!user) return 0;

    const { ROLE_HIERARCHY } = await import('../services/rbacService.js');
    
    // Obtener nivel del rol principal
    let maxLevel = ROLE_HIERARCHY[user.role]?.level || 0;
    
    // Verificar roles adicionales
    for (const roleAssignment of user.roleAssignments || []) {
      const roleLevel = ROLE_HIERARCHY[roleAssignment.role]?.level || 0;
      if (roleLevel > maxLevel) {
        maxLevel = roleLevel;
      }
    }

    return maxLevel;
  } catch (error) {
    console.error('Error obteniendo nivel de usuario:', error);
    return 0;
  }
}

/**
 * Log de acceso no autorizado
 */
async function logUnauthorizedAccess(
  userId: string,
  resource: string,
  action: PermissionAction,
  ipAddress?: string,
  userAgent?: string,
  reason?: string
) {
  try {
    await prisma.securityEvent.create({
      data: {
        eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
        severity: LogSeverity.MEDIUM,
        description: `Acceso denegado: ${reason || 'Permisos insuficientes'}`,
        userId,
        ipAddress,
        userAgent,
        metadata: {
          resource,
          action,
          reason,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Error logging unauthorized access:', error);
  }
}

// Middlewares específicos para recursos comunes
export const requireAdminAccess = requireRoles(['SUPER_ADMIN', 'ADMIN']);
export const requireModeratorAccess = requireRoles(['SUPER_ADMIN', 'ADMIN', 'MODERATOR']);
export const requireEditorAccess = requireRoles(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'EDITOR']);

// Middlewares de permisos por recurso
export const requireEventsRead = requirePermission('events', PermissionAction.READ);
export const requireEventsWrite = requirePermission('events', PermissionAction.CREATE);
export const requireEventsUpdate = requirePermission('events', PermissionAction.UPDATE, {
  resourceIdFromParam: 'id'
});
export const requireEventsDelete = requirePermission('events', PermissionAction.DELETE, {
  resourceIdFromParam: 'id'
});

export const requireUsersManage = requirePermission('users', PermissionAction.MANAGE);
export const requireUsersRead = requirePermission('users', PermissionAction.READ);

export const requireNewsModerate = requirePermission('news', PermissionAction.MODERATE);
export const requireNewsCreate = requirePermission('news', PermissionAction.CREATE);

export const requireForumModerate = requirePermission('forum', PermissionAction.MODERATE);
export const requireForumManage = requirePermission('forum', PermissionAction.MANAGE);
