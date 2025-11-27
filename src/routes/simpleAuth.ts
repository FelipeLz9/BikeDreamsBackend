import { Elysia } from 'elysia';
import { prisma } from '../prisma/client';

export const simpleAuthRoutes = new Elysia({ prefix: '/auth' })
    .post('/login', async (context) => {
        try {
            console.log('🔐 Simple login endpoint called');
            const { body } = context;
            console.log('📧 Body:', body);
            
            if (!body || !body.email || !body.password) {
                return {
                    success: false,
                    error: 'Email y contraseña requeridos',
                    message: 'Se requieren email y contraseña'
                };
            }

            console.log('🔍 Buscando usuario:', body.email);
            
            // Buscar usuario en la base de datos
            const user = await prisma.user.findUnique({
                where: { email: body.email.toLowerCase().trim() }
            });

            if (!user) {
                console.log('❌ Usuario no encontrado');
                return {
                    success: false,
                    error: 'Credenciales inválidas',
                    message: 'Email o contraseña incorrectos'
                };
            }

            console.log('👤 Usuario encontrado:', user.email, user.role);

            // Verificar contraseña
            const bcrypt = await import('bcrypt');
            const isValidPassword = await bcrypt.compare(body.password, user.password);
            
            if (!isValidPassword) {
                console.log('❌ Contraseña incorrecta');
                return {
                    success: false,
                    error: 'Credenciales inválidas',
                    message: 'Email o contraseña incorrectos'
                };
            }

            console.log('✅ Login exitoso');

            // Generar token simple
            const jwt = await import('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
            
            const accessToken = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email, 
                    role: user.role 
                },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const { password: _, ...userWithoutPassword } = user;

            return {
                success: true,
                message: 'Login exitoso',
                user: userWithoutPassword,
                accessToken: accessToken
            };

        } catch (error) {
            console.error('💥 Error en login:', error);
            return {
                success: false,
                error: 'Error interno del servidor',
                message: 'Ocurrió un error procesando el login'
            };
        }
    })
    .get('/me', async (context) => {
        return {
            success: true,
            message: 'Me endpoint working',
            timestamp: new Date().toISOString()
        };
    });
