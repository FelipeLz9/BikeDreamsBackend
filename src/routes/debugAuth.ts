import { Elysia } from 'elysia';
import { prisma } from '../prisma/client';

export const debugAuthRoutes = new Elysia({ prefix: '/debug' })
    .post('/login', async (context) => {
        try {
            console.log('🔐 DEBUG LOGIN - Iniciando...');
            const { body } = context;
            console.log('📧 Body recibido:', JSON.stringify(body, null, 2));
            
            if (!body || typeof body !== 'object') {
                console.log('❌ Body inválido');
                return {
                    success: false,
                    error: 'Body inválido',
                    message: 'Se requiere un objeto JSON válido'
                };
            }
            
            if (!body.email || !body.password) {
                console.log('❌ Credenciales faltantes');
                return {
                    success: false,
                    error: 'Credenciales faltantes',
                    message: 'Se requieren email y contraseña'
                };
            }

            console.log('🔍 Buscando usuario en BD:', body.email);
            
            // Buscar usuario en la base de datos
            const user = await prisma.user.findUnique({
                where: { email: body.email.toLowerCase().trim() }
            });

            if (!user) {
                console.log('❌ Usuario no encontrado en BD');
                return {
                    success: false,
                    error: 'Usuario no encontrado',
                    message: 'No existe un usuario con ese email'
                };
            }

            console.log('👤 Usuario encontrado:', {
                id: user.id,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            });

            // Verificar contraseña
            console.log('🔐 Verificando contraseña...');
            const bcrypt = await import('bcrypt');
            const isValidPassword = await bcrypt.compare(body.password, user.password);
            
            if (!isValidPassword) {
                console.log('❌ Contraseña incorrecta');
                return {
                    success: false,
                    error: 'Contraseña incorrecta',
                    message: 'La contraseña no coincide'
                };
            }

            console.log('✅ Contraseña correcta - Generando token...');

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

            console.log('🎉 Login exitoso - Enviando respuesta');

            return {
                success: true,
                message: 'Login exitoso',
                user: userWithoutPassword,
                accessToken: accessToken,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('💥 ERROR EN DEBUG LOGIN:', error);
            console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
            return {
                success: false,
                error: 'Error interno del servidor',
                message: 'Ocurrió un error procesando el login',
                details: error instanceof Error ? error.message : 'Error desconocido'
            };
        }
    })
    .get('/test', () => {
        return {
            success: true,
            message: 'Debug auth endpoint working',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        };
    });
