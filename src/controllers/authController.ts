import { AuthService } from '../services/authService';
import { prisma } from '../prisma/client';
import { SecurityEventType, LogSeverity } from '@prisma/client';
import { logSecurityEvent as logToSecurityLogger } from '../services/securityLogger';

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
 * Registro de nuevo usuario con validaciones robustas
 */
export const register = async (context: any) => {
    const { body, headers } = context;
    try {
        // Validar que el body tenga la estructura esperada
        if (!body || typeof body !== 'object') {
            return {
                success: false,
                error: 'Datos de registro requeridos',
                message: 'Se requieren datos válidos para el registro'
            };
        }

        // Extraer metadata del cliente
        const metadata = extractClientMetadata(headers);

        // Validaciones básicas
        if (!body.name || !body.email || !body.password) {
            await logSecurityEvent({
                eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
                severity: LogSeverity.LOW,
                description: 'Intento de registro con datos incompletos',
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent
            });
            
            return {
                success: false,
                error: 'Todos los campos son requeridos',
                message: 'Nombre, email y contraseña son obligatorios'
            };
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
            return {
                success: false,
                error: 'Email inválido',
                message: 'Por favor ingresa un email válido'
            };
        }

        // Usar el servicio de auth robusto
        const result = await AuthService.register({
            name: body.name.trim(),
            email: body.email.toLowerCase().trim(),
            password: body.password
        }, metadata);

        return {
            success: result.success,
            message: result.message,
            user: result.user,
            ...(result.success ? {} : { error: result.message })
        };

    } catch (error) {
        console.error('Error en controlador de registro:', error);
        
        await logSecurityEvent({
            eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
            severity: LogSeverity.HIGH,
            description: 'Error interno en registro de usuario',
            ipAddress: extractClientMetadata(headers).ipAddress,
            userAgent: extractClientMetadata(headers).userAgent,
            metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        });

        return {
            success: false,
            error: 'Error interno del servidor',
            message: 'Ocurrió un error procesando el registro'
        };
    }
};

/**
 * Login con protección contra ataques de fuerza bruta
 */
export const login = async (context: any) => {
    const { body, headers } = context;
    try {
        // Validar que el body tenga la estructura esperada
        if (!body || typeof body !== 'object') {
            return {
                success: false,
                error: 'Datos de login requeridos',
                message: 'Se requieren email y contraseña'
            };
        }

        // Extraer metadata del cliente
        const metadata = extractClientMetadata(headers);

        // Validaciones básicas
        if (!body.email || !body.password) {
            await logSecurityEvent({
                eventType: SecurityEventType.LOGIN_ATTEMPT,
                severity: LogSeverity.LOW,
                description: 'Intento de login con credenciales incompletas',
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent
            });
            
            return {
                success: false,
                error: 'Credenciales requeridas',
                message: 'Email y contraseña son obligatorios'
            };
        }

        // Usar el servicio de auth robusto
        const result = await AuthService.login(
            body.email.toLowerCase().trim(),
            body.password,
            metadata
        );

        if (!result.success) {
            return {
                success: false,
                error: result.message,
                message: result.message,
                ...(result.lockUntil ? { lockUntil: result.lockUntil } : {})
            };
        }

        return {
            success: true,
            message: result.message,
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
        };

    } catch (error) {
        console.error('Error en controlador de login:', error);
        
        await logSecurityEvent({
            eventType: SecurityEventType.LOGIN_FAILURE,
            severity: LogSeverity.HIGH,
            description: 'Error interno en proceso de login',
            ipAddress: extractClientMetadata(headers).ipAddress,
            userAgent: extractClientMetadata(headers).userAgent,
            metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        });

        return {
            success: false,
            error: 'Error interno del servidor',
            message: 'Ocurrió un error procesando el login'
        };
    }
};

/**
 * Renovar access token usando refresh token
 */
export const refreshToken = async (context: any) => {
    const { body, headers } = context;
    try {
        // Validar que el body tenga la estructura esperada
        if (!body || typeof body !== 'object') {
            return {
                success: false,
                error: 'Refresh token requerido',
                message: 'Se requiere un refresh token válido'
            };
        }

        const metadata = extractClientMetadata(headers);

        if (!body.refreshToken) {
            return {
                success: false,
                error: 'Refresh token requerido',
                message: 'Token de renovación es obligatorio'
            };
        }

        const result = await AuthService.refreshAccessToken(body.refreshToken, metadata);

        return {
            success: result.success,
            message: result.message,
            ...(result.success ? { accessToken: result.accessToken } : { error: result.message })
        };

    } catch (error) {
        console.error('Error renovando token:', error);
        return {
            success: false,
            error: 'Error interno del servidor',
            message: 'Error renovando token de acceso'
        };
    }
};

/**
 * Logout seguro
 */
export const logout = async (context: any) => {
    const { user, tokenPayload, headers, body } = context;
    try {
        const metadata = extractClientMetadata(headers);
        const sessionId = body?.logoutAllSessions ? undefined : tokenPayload?.sessionId;

        const result = await AuthService.logout(user.id, sessionId, metadata);

        return {
            success: result.success,
            message: result.message
        };

    } catch (error) {
        console.error('Error en logout:', error);
        return {
            success: false,
            error: 'Error interno del servidor',
            message: 'Error procesando logout'
        };
    }
};

/**
 * Verificar estado de autenticación
 */
export const me = async (context: any) => {
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

/**
 * Cambiar contraseña
 */
export const changePassword = async (context: any) => {
    const { user, body, headers } = context;
    try {
        // Validar que el body tenga la estructura esperada
        if (!body || typeof body !== 'object') {
            return {
                success: false,
                error: 'Datos de cambio de contraseña requeridos',
                message: 'Se requieren contraseña actual y nueva'
            };
        }

        const metadata = extractClientMetadata(headers);

        if (!body.currentPassword || !body.newPassword) {
            return {
                success: false,
                error: 'Contraseñas requeridas',
                message: 'Contraseña actual y nueva son obligatorias'
            };
        }

        // Verificar contraseña actual
        const currentUser = await prisma.user.findUnique({
            where: { id: user.id }
        });

        if (!currentUser) {
            return {
                success: false,
                error: 'Usuario no encontrado',
                message: 'Usuario no existe'
            };
        }

        const bcrypt = await import('bcrypt');
        const isValidCurrentPassword = await bcrypt.compare(body.currentPassword, currentUser.password);

        if (!isValidCurrentPassword) {
            await logSecurityEvent({
                eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
                severity: LogSeverity.MEDIUM,
                description: `Intento de cambio de contraseña con contraseña actual incorrecta: ${user.email}`,
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                userId: user.id
            });

            return {
                success: false,
                error: 'Contraseña actual incorrecta',
                message: 'La contraseña actual no es correcta'
            };
        }

        // Validar nueva contraseña
        const passwordValidation = validatePasswordStrength(body.newPassword);
        if (!passwordValidation.isValid) {
            return {
                success: false,
                error: 'Contraseña débil',
                message: `Nueva contraseña ${passwordValidation.errors.join(', ')}`
            };
        }

        // Hash de nueva contraseña
        const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
        const hashedNewPassword = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);

        // Actualizar contraseña
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedNewPassword,
                updatedAt: new Date()
            }
        });

        // Revocar todas las sesiones (forzar re-login)
        await AuthService.logout(user.id, undefined, metadata);

        // Log de auditoría
        await logAuditEvent({
            userId: user.id,
            action: 'PASSWORD_CHANGED',
            resource: 'User',
            resourceId: user.id,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            success: true
        });

        return {
            success: true,
            message: 'Contraseña cambiada exitosamente. Por favor, inicia sesión nuevamente.'
        };

    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        return {
            success: false,
            error: 'Error interno del servidor',
            message: 'Error cambiando contraseña'
        };
    }
};

// Validar fortaleza de contraseña
function validatePasswordStrength(password: string) {
    const errors: string[] = [];
    
    if (password.length < 8) {
        errors.push('debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('debe contener al menos una mayúscula');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('debe contener al menos una minúscula');
    }
    if (!/\d/.test(password)) {
        errors.push('debe contener al menos un número');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('debe contener al menos un símbolo especial');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Función para logging de eventos de seguridad
async function logSecurityEvent(event: {
    eventType: SecurityEventType;
    severity: LogSeverity;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    userId?: string;
    metadata?: any;
}) {
    try {
        await prisma.securityEvent.create({
            data: event
        });
    } catch (error) {
        console.error('Error logging security event:', error);
    }
}

// Función para logging de auditoría
async function logAuditEvent(event: {
    userId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
}) {
    try {
        await prisma.auditLog.create({
            data: {
                ...event,
                severity: event.success ? LogSeverity.INFO : LogSeverity.MEDIUM
            }
        });
    } catch (error) {
        console.error('Error logging audit event:', error);
    }
}
