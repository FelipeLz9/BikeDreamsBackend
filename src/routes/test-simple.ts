import { Elysia } from 'elysia';

export const testSimpleRoutes = new Elysia({ prefix: '/test-simple' })
    .get('/ping', () => ({
        success: true,
        message: 'Pong! Servidor funcionando correctamente',
        timestamp: new Date().toISOString()
    }))
    .post('/login-test', ({ body }) => {
        // Simular login sin base de datos
        const { email, password } = body as { email: string; password: string };
        
        if (email === 'test@example.com' && password === 'TestPassword123!') {
            return {
                success: true,
                message: 'Login exitoso (simulado)',
                user: {
                    id: 'test-user-123',
                    name: 'Usuario de Prueba',
                    email: 'test@example.com',
                    role: 'CLIENT'
                },
                accessToken: 'fake-jwt-token-for-testing',
                refreshToken: 'fake-refresh-token-for-testing'
            };
        } else {
            return {
                success: false,
                error: 'Credenciales inválidas',
                message: 'Email o contraseña incorrectos'
            };
        }
    });
