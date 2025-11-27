import { Elysia } from 'elysia';

export const testBasicRoutes = new Elysia({ prefix: '/test-basic' })
    .get('/ping', () => ({
        success: true,
        message: 'Pong! Servidor funcionando',
        timestamp: new Date().toISOString()
    }))
    .post('/login-test', ({ body }) => {
        const { email, password } = body as { email: string; password: string };
        
        if (email === 'test@example.com' && password === 'TestPassword123!') {
            return {
                success: true,
                message: 'Login exitoso (sin base de datos)',
                user: {
                    id: 'test-user-123',
                    name: 'Usuario de Prueba',
                    email: 'test@example.com',
                    role: 'CLIENT'
                },
                accessToken: 'fake-jwt-token-for-testing'
            };
        } else {
            return {
                success: false,
                error: 'Credenciales inválidas'
            };
        }
    });
