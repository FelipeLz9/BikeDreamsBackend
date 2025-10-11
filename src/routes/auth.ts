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
    .post('/login', async ({ body, headers, validateBody }) => {
        const validatedBody = validateBody(loginSchema, body);
        return login({ body: validatedBody, headers });
    })
    .post('/register', async ({ body, headers, validateBody }) => {
        const validatedBody = validateBody(registerSchema, body);
        return register({ body: validatedBody, headers });
    })
    .post('/refresh', async ({ body, headers, validateBody }) => {
        const validatedBody = validateBody(refreshTokenSchema, body);
        return refreshToken({ body: validatedBody, headers });
    })
    .use(requireAuth)
    .post('/logout', ({ user, tokenPayload, headers, body }) => logout({ user, tokenPayload, headers, body }))
    .get('/me', ({ user }) => me({ user }))
    .post('/change-password', async ({ user, body, headers, validateBody }) => {
        const validatedBody = validateBody(changePasswordSchema, body);
        return changePassword({ user, body: validatedBody, headers });
    });
