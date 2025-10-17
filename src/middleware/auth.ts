import { Elysia } from 'elysia';
import { AuthService } from '../services/authService';
import { prisma } from '../prisma/client';
import { SecurityEventType, LogSeverity } from '@prisma/client';

// Middleware base de autenticación
export const authMiddleware = new Elysia()
    .derive(async ({ request }) => {
        // Extraer información del cliente
        const forwarded = request.headers.get('x-forwarded-for') || undefined;
        const clientIp = forwarded ? forwarded.split(',')[0].trim() : 
                        request.headers.get('x-real-ip') || 
                        'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { 
                user: null, 
                isAuthenticated: false,
                clientIp,
                userAgent
            };
        }

        const token = authHeader.split(' ')[1];
        
        try {
            const result = await AuthService.verifyToken(token);
            
            if (!result.valid || !result.payload) {
                // Log intento de acceso con token inválido
                await logSecurityEvent({
                    eventType: SecurityEventType.TOKEN_MISUSE,
                    severity: LogSeverity.MEDIUM,
                    description: `Token inválido usado desde IP: ${clientIp}`,
                    ipAddress: clientIp,
                    userAgent: userAgent,
                    metadata: { error: result.error }
                });
                
                return { 
                    user: null, 
                    isAuthenticated: false,
                    clientIp,
                    userAgent,
                    tokenError: result.error
                };
            }

            // Obtener datos completos del usuario
            const user = await prisma.user.findUnique({
                where: { id: result.payload.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    lastLogin: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            if (!user || !user.isActive) {
                await logSecurityEvent({
                    eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
                    severity: LogSeverity.HIGH,
                    description: `Acceso con usuario inválido/inactivo: ${result.payload.email}`,
                    ipAddress: clientIp,
                    userAgent: userAgent,
                    userId: result.payload.id
                });
                
                return { 
                    user: null, 
                    isAuthenticated: false,
                    clientIp,
                    userAgent
                };
            }

            return { 
                user, 
                isAuthenticated: true,
                tokenPayload: result.payload,
                clientIp,
                userAgent
            };
        } catch (error) {
            console.error('Error en middleware de auth:', error);
            
            await logSecurityEvent({
                eventType: SecurityEventType.TOKEN_MISUSE,
                severity: LogSeverity.HIGH,
                description: `Error procesando token desde IP: ${clientIp}`,
                ipAddress: clientIp,
                userAgent: userAgent,
                metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
            
            return { 
                user: null, 
                isAuthenticated: false,
                clientIp,
                userAgent
            };
        }
    });

// Middleware que requiere autenticación
export const requireAuth = new Elysia()
    .use(authMiddleware)
    .onBeforeHandle(({ user, isAuthenticated, clientIp, userAgent, tokenError, set }: any) => {
        if (!isAuthenticated || !user) {
            set.status = 401;
            return {
                error: 'Unauthorized',
                message: tokenError || 'Token de acceso requerido'
            };
        }
    });

// Middleware que requiere rol específico
export const requireRole = (roles: string[]) => {
    return new Elysia()
        .use(authMiddleware)
        .onBeforeHandle(async ({ user, isAuthenticated, clientIp, userAgent, set }: any) => {
            if (!isAuthenticated || !user) {
                set.status = 401;
                return {
                    error: 'Unauthorized',
                    message: 'Token de acceso requerido'
                };
            }

            if (!roles.includes(user.role)) {
                // Log intento de acceso sin permisos
                await logSecurityEvent({
                    eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
                    severity: LogSeverity.HIGH,
                    description: `Acceso denegado por rol insuficiente. Usuario: ${user.email}, Role: ${user.role}, Required: ${roles.join('|')}`,
                    ipAddress: clientIp,
                    userAgent: userAgent,
                    userId: user.id,
                    metadata: {
                        userRole: user.role,
                        requiredRoles: roles
                    }
                });

                set.status = 403;
                return {
                    error: 'Forbidden',
                    message: 'Permisos insuficientes para acceder a este recurso'
                };
            }
        });
};

// Middleware específico para administradores
export const requireAdmin = requireRole(['SUPER_ADMIN', 'ADMIN']);

// Middleware de compatibilidad hacia atrás
export const requireSuperAdmin = requireRole(['SUPER_ADMIN']);

// Middleware para endpoints opcionales de autenticación
export const optionalAuth = authMiddleware;

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
