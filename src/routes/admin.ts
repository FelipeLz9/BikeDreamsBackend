import { Elysia } from 'elysia';
import { 
    getAdminStats, 
    getAdminUsers, 
    createAdminUser, 
    updateAdminUser, 
    deleteAdminUser 
} from '../controllers/adminController';
import { adminSecurityMiddleware } from '../middleware/strictSecurity';
import { fullValidationPlugin } from '../plugins/validationPlugin';

export const adminRoutes = new Elysia({ prefix: '/admin' })
    .use(adminSecurityMiddleware()) // Seguridad estricta para admin
    .use(fullValidationPlugin({ contentType: 'user', logAttempts: true, strictMode: true }))
    .get('/stats', getAdminStats)
    .get('/users', getAdminUsers)
    .post('/users', createAdminUser)
    .put('/users/:id', updateAdminUser)
    .delete('/users/:id', deleteAdminUser);
