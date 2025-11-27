import { AuthService } from '../services/authService';
import { prisma } from '../prisma/client';

// Interfaz para metadata del cliente
interface ClientMetadata {
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
}

// Extraer metadata del cliente desde headers
function extractClientMetadata(headers: any): ClientMetadata {
    const forwarded = headers['x-forwarded-for'] as string;
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 
                     headers['x-real-ip'] as string || 
                     'unknown';
    
    return {
        ipAddress,
        userAgent: headers['user-agent'] || 'unknown',
        deviceId: headers['x-device-id'] || undefined
    };
}

/**
 * Login simplificado para desarrollo
 */
export const devLogin = async (context: any) => {
    const { body, headers } = context;
    try {
        console.log('🔐 Intentando login en modo desarrollo...');
        console.log('📧 Email:', body?.email);
        
        // Validar que el body tenga la estructura esperada
        if (!body || typeof body !== 'object') {
            console.log('❌ Body inválido');
            return {
                success: false,
                error: 'Datos de login requeridos',
                message: 'Se requieren email y contraseña'
            };
        }

        // Extraer metadata del cliente
        const metadata = extractClientMetadata(headers);
        console.log('🌐 Metadata:', metadata);

        // Validaciones básicas
        if (!body.email || !body.password) {
            console.log('❌ Credenciales incompletas');
            return {
                success: false,
                error: 'Credenciales requeridas',
                message: 'Email y contraseña son obligatorios'
            };
        }

        console.log('🔍 Buscando usuario en la base de datos...');
        
        // Buscar usuario directamente en la base de datos
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

        // Generar tokens simples
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
};

/**
 * Verificar estado de autenticación simplificado
 */
export const devMe = async (context: any) => {
    const { user } = context;
    try {
        if (!user) {
            return {
                success: false,
                error: 'No autenticado',
                message: 'Usuario no autenticado'
            };
        }

        return {
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt
            }
        };

    } catch (error) {
        console.error('Error obteniendo datos del usuario:', error);
        return {
            success: false,
            error: 'Error interno del servidor',
            message: 'Error obteniendo datos del usuario'
        };
    }
};
