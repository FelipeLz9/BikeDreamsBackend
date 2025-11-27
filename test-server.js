import { Elysia } from 'elysia';

const app = new Elysia()
    .get('/', () => ({
        message: 'Servidor de prueba funcionando!',
        timestamp: new Date().toISOString()
    }))
    .get('/test', () => ({
        success: true,
        message: 'Endpoint de prueba funcionando'
    }))
    .post('/login-test', ({ body }) => {
        const { email, password } = body;
        
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
    })
    .listen(3002);

console.log('🚀 Servidor de prueba corriendo en http://localhost:3002');

