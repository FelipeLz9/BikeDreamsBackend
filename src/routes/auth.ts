import { Elysia } from 'elysia';
import { login, register, refreshToken, logout, me, changePassword } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiterMiddleware } from '../middleware/rateLimiter.js';
import { fullValidationPlugin } from '../plugins/validationPlugin.js';
import { authSecurityMiddleware } from '../middleware/strictSecurity.js';
import {
    loginSchema,
    registerSchema,
    refreshTokenSchema,
    changePasswordSchema
} from '../validation/authValidation.js';

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(authSecurityMiddleware()) // Headers de seguridad específicos para auth
    .use(rateLimiterMiddleware)
    .use(fullValidationPlugin({ contentType: 'user', logAttempts: true }))
    .post('/login', login)
    .post('/register', register)
    .post('/refresh', refreshToken)
    .use(requireAuth)
    .post('/logout', logout)
    .get('/me', me)
    .post('/change-password', changePassword);
