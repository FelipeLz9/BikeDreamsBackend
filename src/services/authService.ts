import { prisma } from '../prisma/client.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { SecurityEventType, LogSeverity } from '@prisma/client';

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-refresh-secret';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOCKOUT_TIME = parseInt(process.env.LOCKOUT_TIME || '30'); // minutes
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export interface LoginResult {
  success: boolean;
  user?: any;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  lockUntil?: Date;
}

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  sessionId?: string;
}

export class AuthService {
  /**
   * Registra un nuevo usuario con validaciones de seguridad
   */
  static async register(userData: {
    name: string;
    email: string;
    password: string;
  }, metadata: { ipAddress?: string; userAgent?: string } = {}) {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        await this.logSecurityEvent({
          eventType: SecurityEventType.LOGIN_ATTEMPT,
          severity: LogSeverity.INFO,
          description: `Intento de registro con email existente: ${userData.email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        });
        return { success: false, message: 'El email ya está registrado' };
      }

      // Validar fortaleza de contraseña
      const passwordValidation = this.validatePasswordStrength(userData.password);
      if (!passwordValidation.isValid) {
        return { 
          success: false, 
          message: `Contraseña débil: ${passwordValidation.errors.join(', ')}` 
        };
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(userData.password, BCRYPT_ROUNDS);

      // Crear usuario
      const user = await prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
        }
      });

      // Log de auditoría
      await this.logAuditEvent({
        userId: user.id,
        action: 'USER_REGISTERED',
        resource: 'User',
        resourceId: user.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: true
      });

      const { password: _, ...userWithoutPassword } = user;
      return { 
        success: true, 
        message: 'Usuario registrado exitosamente',
        user: userWithoutPassword 
      };

    } catch (error) {
      console.error('Error en registro:', error);
      return { success: false, message: 'Error interno del servidor' };
    }
  }

  /**
   * Login con protección contra ataques de fuerza bruta
   */
  static async login(
    email: string, 
    password: string,
    metadata: { ipAddress?: string; userAgent?: string; deviceId?: string } = {}
  ): Promise<LoginResult> {
    try {
      // Buscar usuario
      const user = await prisma.user.findUnique({
        where: { email }
      });

      // Log del intento de login
      await this.logSecurityEvent({
        eventType: SecurityEventType.LOGIN_ATTEMPT,
        severity: LogSeverity.INFO,
        description: `Intento de login para: ${email}`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        userId: user?.id
      });

      if (!user) {
        await this.logSecurityEvent({
          eventType: SecurityEventType.LOGIN_FAILURE,
          severity: LogSeverity.MEDIUM,
          description: `Intento de login con email inexistente: ${email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        });
        return { success: false, message: 'Credenciales inválidas' };
      }

      // Verificar si la cuenta está bloqueada
      if (user.lockUntil && user.lockUntil > new Date()) {
        await this.logSecurityEvent({
          eventType: SecurityEventType.ACCOUNT_LOCKED,
          severity: LogSeverity.HIGH,
          description: `Intento de login en cuenta bloqueada: ${email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          userId: user.id
        });
        return { 
          success: false, 
          message: 'Cuenta bloqueada temporalmente',
          lockUntil: user.lockUntil 
        };
      }

      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        // Incrementar intentos fallidos
        const newAttempts = user.loginAttempts + 1;
        const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
        
        const updateData: any = {
          loginAttempts: newAttempts
        };

        if (shouldLock) {
          updateData.lockUntil = new Date(Date.now() + LOCKOUT_TIME * 60 * 1000);
          
          await this.logSecurityEvent({
            eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
            severity: LogSeverity.HIGH,
            description: `Cuenta bloqueada por intentos excesivos: ${email}`,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            userId: user.id
          });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });

        await this.logSecurityEvent({
          eventType: SecurityEventType.LOGIN_FAILURE,
          severity: LogSeverity.MEDIUM,
          description: `Login fallido (${newAttempts}/${MAX_LOGIN_ATTEMPTS}): ${email}`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          userId: user.id
        });

        return { 
          success: false, 
          message: shouldLock ? 'Cuenta bloqueada por intentos excesivos' : 'Credenciales inválidas'
        };
      }

      // Login exitoso - resetear intentos fallidos
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockUntil: null,
          lastLogin: new Date()
        }
      });

      // Generar tokens
      const { accessToken, refreshToken, sessionId } = await this.generateTokens(
        user, 
        metadata
      );

      // Log de auditoría de login exitoso
      await this.logAuditEvent({
        userId: user.id,
        action: 'USER_LOGIN',
        resource: 'User',
        resourceId: user.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: true,
        details: { sessionId }
      });

      const { password: _, loginAttempts, lockUntil, ...userWithoutSensitiveData } = user;

      return {
        success: true,
        user: userWithoutSensitiveData,
        accessToken,
        refreshToken,
        message: 'Login exitoso'
      };

    } catch (error) {
      console.error('Error en login:', error);
      
      await this.logSecurityEvent({
        eventType: SecurityEventType.LOGIN_FAILURE,
        severity: LogSeverity.HIGH,
        description: `Error interno en login: ${email}`,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      });

      return { success: false, message: 'Error interno del servidor' };
    }
  }

  /**
   * Generar tokens de acceso y refresh
   */
  private static async generateTokens(
    user: any,
    metadata: { ipAddress?: string; userAgent?: string; deviceId?: string } = {}
  ) {
    // Crear sesión
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        sessionToken: crypto.randomUUID(),
        deviceId: metadata.deviceId,
        ipAddress: metadata.ipAddress || 'unknown',
        userAgent: metadata.userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
      }
    });

    // Payload para JWT
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id
    };

    // Generar access token
    const accessToken = jwt.sign(
      payload,
      JWT_SECRET as string,
      {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'bikedreams-api',
        audience: 'bikedreams-app'
      }
    );

    // Generar refresh token
    const refreshTokenValue = crypto.randomBytes(64).toString('hex');
    
    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        deviceId: metadata.deviceId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      }
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      sessionId: session.id
    };
  }

  /**
   * Renovar access token usando refresh token
   */
  static async refreshAccessToken(refreshToken: string, metadata: any = {}) {
    try {
      const storedRefreshToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true }
      });

      if (!storedRefreshToken || storedRefreshToken.isRevoked || storedRefreshToken.expiresAt < new Date()) {
        await this.logSecurityEvent({
          eventType: SecurityEventType.TOKEN_MISUSE,
          severity: LogSeverity.HIGH,
          description: 'Intento de uso de refresh token inválido',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        });
        return { success: false, message: 'Refresh token inválido' };
      }

      // Generar nuevo access token
      const payload: TokenPayload = {
        id: storedRefreshToken.user.id,
        email: storedRefreshToken.user.email,
        role: storedRefreshToken.user.role
      };

      const accessToken = jwt.sign(payload, JWT_SECRET as string, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'bikedreams-api',
        audience: 'bikedreams-app'
      });

      // Log de auditoría
      await this.logAuditEvent({
        userId: storedRefreshToken.user.id,
        action: 'TOKEN_REFRESHED',
        resource: 'RefreshToken',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: true
      });

      return {
        success: true,
        accessToken,
        message: 'Token renovado exitosamente'
      };

    } catch (error) {
      console.error('Error renovando token:', error);
      return { success: false, message: 'Error interno del servidor' };
    }
  }

  /**
   * Logout seguro
   */
  static async logout(userId: string, sessionId?: string, metadata: any = {}) {
    try {
      // Revocar refresh tokens
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true }
      });

      // Desactivar sesión específica o todas
      if (sessionId) {
        await prisma.userSession.update({
          where: { id: sessionId },
          data: { isActive: false }
        });
      } else {
        await prisma.userSession.updateMany({
          where: { userId },
          data: { isActive: false }
        });
      }

      // Log de auditoría
      await this.logAuditEvent({
        userId,
        action: 'USER_LOGOUT',
        resource: 'UserSession',
        resourceId: sessionId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: true
      });

      return { success: true, message: 'Logout exitoso' };

    } catch (error) {
      console.error('Error en logout:', error);
      return { success: false, message: 'Error interno del servidor' };
    }
  }

  /**
   * Verificar token JWT
   */
  static async verifyToken(token: string): Promise<{ valid: boolean; payload?: TokenPayload; error?: string }> {
    try {
      const payload = jwt.verify(token, JWT_SECRET as string, {
        issuer: 'bikedreams-api',
        audience: 'bikedreams-app'
      }) as TokenPayload;

      // Verificar sesión si existe sessionId
      if (payload.sessionId) {
        const session = await prisma.userSession.findUnique({
          where: { id: payload.sessionId }
        });

        if (!session || !session.isActive || session.expiresAt < new Date()) {
          return { valid: false, error: 'Sesión inválida o expirada' };
        }

        // Actualizar última actividad
        await prisma.userSession.update({
          where: { id: payload.sessionId },
          data: { lastActivity: new Date() }
        });
      }

      return { valid: true, payload };

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Token inválido' };
      }
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Token expirado' };
      }
      return { valid: false, error: 'Error verificando token' };
    }
  }

  /**
   * Validar fortaleza de contraseña
   */
  private static validatePasswordStrength(password: string) {
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

  /**
   * Log de eventos de seguridad
   */
  private static async logSecurityEvent(event: {
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

  /**
   * Log de auditoría
   */
  private static async logAuditEvent(event: {
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

  /**
   * Limpiar tokens y sesiones expiradas
   */
  static async cleanupExpiredTokens() {
    try {
      const now = new Date();
      
      // Eliminar refresh tokens expirados
      await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { isRevoked: true }
          ]
        }
      });

      // Desactivar sesiones expiradas
      await prisma.userSession.updateMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { lastActivity: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
          ]
        },
        data: { isActive: false }
      });

    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
    }
  }
}
