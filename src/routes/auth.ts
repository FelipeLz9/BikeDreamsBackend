import { Elysia } from 'elysia';
import { login, register, refreshToken, logout, me, changePassword } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiterMiddleware } from '../middleware/rateLimiter.js';
import { fullValidationPlugin } from '../plugins/validationPlugin.js';
import { authSecurityMiddleware } from '../middleware/strictSecurity.js';
import { devAuthMiddleware } from '../middleware/devAuth.js';
import {
    loginSchema,
    registerSchema,
    refreshTokenSchema,
    changePasswordSchema
} from '../validation/authValidation.js';

const isDevelopment = process.env.NODE_ENV === 'development';

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(isDevelopment ? devAuthMiddleware() : authSecurityMiddleware()) // Headers de seguridad específicos para auth
    .use(isDevelopment ? (app: any) => app : rateLimiterMiddleware) // Deshabilitar rate limiting en desarrollo
    .use(isDevelopment ? (app: any) => app : fullValidationPlugin({ contentType: 'user', logAttempts: true })) // Deshabilitar validación estricta en desarrollo
    // Handler para preflight requests (OPTIONS)
    .options('/login', () => ({ success: true, message: 'CORS preflight' }))
    .options('/register', () => ({ success: true, message: 'CORS preflight' }))
    .options('/refresh', () => ({ success: true, message: 'CORS preflight' }))
    .options('/logout', () => ({ success: true, message: 'CORS preflight' }))
    .options('/me', () => ({ success: true, message: 'CORS preflight' }))
    .options('/change-password', () => ({ success: true, message: 'CORS preflight' }))
    .post('/login', login)
    .post('/register', register)
    .post('/refresh', refreshToken)
    .use(requireAuth)
    .post('/logout', logout)
    .get('/me', me)
    .post('/change-password', changePassword);
