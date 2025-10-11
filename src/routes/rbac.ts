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
} from '../controllers/rbacController.js';
import {
  requireAdminAccess,
  requireModeratorAccess,
  requireUserManagementPermission,
  requirePermission,
  requireRoles
} from '../middleware/rbacMiddleware.js';
import { requireAuth } from '../middleware/auth.js';
import { PermissionAction } from '@prisma/client';

export const rbacRoutes = new Elysia({ prefix: '/rbac' })
  .use(requireAuth)
  
  // Rutas públicas (para usuarios autenticados)
  .get('/my-permissions', ({ user }) => getUserPermissions({ params: { userId: user.id } }))
  
  // Rutas que requieren permisos de lectura
  .use(requireModeratorAccess)
  .get('/roles', getRoles)
  .get('/permissions', getPermissions)
  .get('/users', ({ query }) => getUsersWithRoles({ query }))
  .get('/stats', getRBACStats)
  
  // Verificación de permisos (moderadores pueden verificar)
  .post('/users/:userId/check-permission', ({ params, body }) => 
    checkUserPermission({ params, body }))
  
  // Rutas que requieren permisos administrativos
  .use(requireAdminAccess)
  .get('/users/:userId/permissions', ({ params }) => getUserPermissions({ params }))
  
  // Gestión de roles - requiere permisos de usuario
  .use(requireUserManagementPermission())
  .post('/users/:userId/roles', ({ params, body, user }) => 
    assignUserRole({ params, body, user }))
  .delete('/users/:userId/roles', ({ params, body, user }) => 
    revokeUserRole({ params, body, user }))
  
  // Gestión de permisos específicos
  .post('/users/:userId/permissions', ({ params, body, user }) => 
    grantUserPermission({ params, body, user }))
  .delete('/users/:userId/permissions', ({ params, body, user }) => 
    revokeUserPermission({ params, body, user }))
  
  // Inicialización del sistema (solo super admin)
  .use(requireRoles(['SUPER_ADMIN']))
  .post('/initialize', ({ user }) => initializePermissions({ user }));
