import { Elysia } from 'elysia';
import { devLogin, devMe } from '../controllers/devAuthController.js';
import { requireAuth } from '../middleware/auth.js';
import { devAuthMiddleware } from '../middleware/devAuth.js';

export const devAuthRoutes = new Elysia({ prefix: '/auth' })
    .use(devAuthMiddleware()) // Headers básicos para desarrollo
    .post('/login', devLogin)
    .use(requireAuth)
    .get('/me', devMe);
