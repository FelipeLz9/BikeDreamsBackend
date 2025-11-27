import { Elysia } from 'elysia';

export const testAuthRoutes = new Elysia({ prefix: '/test' })
    .get('/auth', () => {
        return {
            message: 'Test auth endpoint working',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        };
    })
    .post('/login', async (context) => {
        const { body } = context;
        console.log('🔐 Test login endpoint called');
        console.log('📧 Body:', body);
        
        return {
            success: true,
            message: 'Test login endpoint working',
            receivedData: body,
            timestamp: new Date().toISOString()
        };
    });
