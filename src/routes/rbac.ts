import { Elysia } from 'elysia';
import {
  getRoles,
  getPermissions,
  getUserPermissions,
  assignUserRole,
  revokeUserRole,
  grantUserPermission,
  revokeUserPermission,
  getUsersWithRoles,
  checkUserPermission,
  getRBACStats,
  initializePermissions
} from '../controllers/rbacController';
import {
  requireAdminAccess,
  requireModeratorAccess,
  requireUserManagementPermission,
  requirePermission,
  requireRoles
} from '../middleware/rbacMiddleware';
import { requireAuth } from '../middleware/auth';
import { PermissionAction } from '@prisma/client';

export const rbacRoutes = new Elysia({ prefix: '/rbac' })
  .use(requireAuth)
  
  // Rutas públicas (para usuarios autenticados)
  .get('/my-permissions', (context: any) => getUserPermissions({ params: { userId: context.user.id } }))
  
  // Rutas que requieren permisos de lectura
  .use(requireModeratorAccess)
  .get('/roles', getRoles)
  .get('/permissions', getPermissions)
  .get('/users', (context: any) => getUsersWithRoles({ query: context.query }))
  .get('/stats', getRBACStats)
  
  // Verificación de permisos (moderadores pueden verificar)
  .post('/users/:userId/check-permission', (context: any) => 
    checkUserPermission({ params: context.params, body: context.body as any }))
  
  // Rutas que requieren permisos administrativos
  .use(requireAdminAccess)
  .get('/users/:userId/permissions', (context: any) => getUserPermissions({ params: context.params }))
  
  // Gestión de roles - requiere permisos de usuario
  .use(requireUserManagementPermission())
  .post('/users/:userId/roles', (context: any) => 
    assignUserRole({ params: context.params, body: context.body as any, user: context.user }))
  .delete('/users/:userId/roles', (context: any) => 
    revokeUserRole({ params: context.params, body: context.body as any, user: context.user }))
  
  // Gestión de permisos específicos
  .post('/users/:userId/permissions', (context: any) => 
    grantUserPermission({ params: context.params, body: context.body as any, user: context.user }))
  .delete('/users/:userId/permissions', (context: any) => 
    revokeUserPermission({ params: context.params, body: context.body as any, user: context.user }))
  
  // Inicialización del sistema (solo super admin)
  .use(requireRoles(['SUPER_ADMIN']))
  .post('/initialize', (context: any) => initializePermissions({ user: context.user }));
