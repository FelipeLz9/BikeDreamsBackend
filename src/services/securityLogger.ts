import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Asegurar que el directorio de logs existe
const logsDir = path.join(__dirname, '../../logs/security');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Interfaces para tipado
interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'validation' | 'attack_attempt' | 'suspicious_activity' | 'system_breach' | 'rate_limit' | 'file_upload';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip?: string;
  userAgent?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  details?: any;
  timestamp?: Date;
  fingerprint?: string;
  location?: string;
  riskScore?: number;
}

interface AttackAttempt extends SecurityEvent {
  attackType: 'xss' | 'sql_injection' | 'csrf' | 'path_traversal' | 'command_injection' | 'brute_force' | 'dos' | 'unknown';
  payload?: string;
  blocked: boolean;
  source: 'body' | 'query' | 'params' | 'headers' | 'file';
}

interface AuthenticationEvent extends SecurityEvent {
  action: 'login_success' | 'login_failure' | 'logout' | 'token_refresh' | 'password_change' | 'account_locked' | 'account_unlocked';
  username?: string;
  failureReason?: string;
  consecutiveFailures?: number;
  deviceInfo?: any;
}

interface AuthorizationEvent extends SecurityEvent {
  action: 'access_granted' | 'access_denied' | 'privilege_escalation_attempt' | 'role_change' | 'permission_change';
  resource?: string;
  requiredPermission?: string;
  userRole?: string;
  attemptedAction?: string;
}

// Usar nuestro logger simple en lugar de Winston
const securityLogger = logger;

// Contadores para estadísticas en tiempo real
const securityStats = {
  totalEvents: 0,
  attackAttempts: 0,
  blockedAttacks: 0,
  authFailures: 0,
  suspiciousIPs: new Set<string>(),
  lastReset: new Date()
};

// Lista negra de IPs temporales
const blockedIPs = new Map<string, { blockedAt: Date; attempts: number; reason: string }>();

export class SecurityLogger {
  /**
   * Log de evento de seguridad general
   */
  static logSecurityEvent(event: SecurityEvent): void {
    const enrichedEvent = {
      ...event,
      timestamp: event.timestamp || new Date(),
      eventId: generateEventId(),
      sessionId: generateSessionId(),
    };

    // Actualizar estadísticas
    securityStats.totalEvents++;

    // Log según severidad usando nuestro logger simple
    switch (event.severity) {
      case 'critical':
        securityLogger.error('Security Event', enrichedEvent);
        break;
      case 'high':
        securityLogger.warn('Security Event', enrichedEvent);
        break;
      case 'medium':
        securityLogger.info('Security Event', enrichedEvent);
        break;
      case 'low':
        securityLogger.debug('Security Event', enrichedEvent);
        break;
      default:
        securityLogger.info('Security Event', enrichedEvent);
    }

    // Si es crítico, también crear alerta
    if (event.severity === 'critical') {
      this.createAlert(enrichedEvent);
    }

    // Análisis de patrones de IP
    if (event.ip) {
      this.analyzeIPPattern(event.ip, event);
    }
  }

  /**
   * Log de intento de ataque específico
   */
  static logAttackAttempt(attack: AttackAttempt): void {
    const enrichedAttack = {
      ...attack,
      type: 'attack_attempt' as const,
      timestamp: attack.timestamp || new Date(),
      eventId: generateEventId()
    };

    securityStats.attackAttempts++;
    if (attack.blocked) {
      securityStats.blockedAttacks++;
    }

    securityLogger.error('Attack Attempt Detected', enrichedAttack);

    // Bloquear IP temporalmente si es un ataque de alto riesgo
    if (attack.severity === 'high' || attack.severity === 'critical') {
      this.temporarilyBlockIP(attack.ip!, attack.attackType, 'High risk attack detected');
    }

    // Crear alerta inmediata para ataques críticos
    if (attack.severity === 'critical') {
      this.createCriticalAlert(enrichedAttack);
    }
  }

  /**
   * Log de eventos de autenticación
   */
  static logAuthEvent(auth: AuthenticationEvent): void {
    const enrichedAuth = {
      ...auth,
      type: 'authentication' as const,
      timestamp: auth.timestamp || new Date(),
      eventId: generateEventId()
    };

    if (auth.action === 'login_failure') {
      securityStats.authFailures++;
    }

    // Determinar severidad basada en la acción
    if (auth.action === 'login_failure' && auth.consecutiveFailures && auth.consecutiveFailures > 5) {
      enrichedAuth.severity = 'high';
      securityLogger.warn('Potential Brute Force Attack', enrichedAuth);
    } else if (auth.action === 'account_locked') {
      enrichedAuth.severity = 'medium';
      securityLogger.warn('Account Locked', enrichedAuth);
    } else {
      securityLogger.info('Authentication Event', enrichedAuth);
    }

    // Análisis de patrones de autenticación fallida
    if (auth.action === 'login_failure' && auth.ip) {
      this.analyzeAuthFailurePattern(auth.ip, auth.username || 'unknown');
    }
  }

  /**
   * Log de eventos de autorización
   */
  static logAuthzEvent(authz: AuthorizationEvent): void {
    const enrichedAuthz = {
      ...authz,
      type: 'authorization' as const,
      timestamp: authz.timestamp || new Date(),
      eventId: generateEventId()
    };

    if (authz.action === 'privilege_escalation_attempt') {
      enrichedAuthz.severity = 'high';
      securityLogger.warn('Privilege Escalation Attempt', enrichedAuthz);
    } else if (authz.action === 'access_denied') {
      securityLogger.info('Access Denied', enrichedAuthz);
    } else {
      securityLogger.info('Authorization Event', enrichedAuthz);
    }
  }

  /**
   * Log de actividad sospechosa general
   */
  static logSuspiciousActivity(activity: {
    description: string;
    ip?: string;
    userAgent?: string;
    userId?: string;
    details?: any;
    riskScore?: number;
  }): void {
    const event: SecurityEvent = {
      type: 'suspicious_activity',
      severity: activity.riskScore && activity.riskScore > 7 ? 'high' : 'medium',
      ip: activity.ip,
      userAgent: activity.userAgent,
      userId: activity.userId,
      details: {
        description: activity.description,
        ...activity.details
      },
      riskScore: activity.riskScore || 5,
      timestamp: new Date()
    };

    this.logSecurityEvent(event);

    // Agregar IP a lista de sospechosas si el riesgo es alto
    if (activity.ip && activity.riskScore && activity.riskScore > 6) {
      securityStats.suspiciousIPs.add(activity.ip);
    }
  }

  /**
   * Log de eventos de rate limiting
   */
  static logRateLimitEvent(event: {
    ip: string;
    endpoint: string;
    limit: number;
    windowMs: number;
    currentRequests: number;
  }): void {
    this.logSecurityEvent({
      type: 'rate_limit',
      severity: 'medium',
      ip: event.ip,
      endpoint: event.endpoint,
      details: {
        limit: event.limit,
        windowMs: event.windowMs,
        currentRequests: event.currentRequests,
        exceeded: event.currentRequests > event.limit
      }
    });
  }

  /**
   * Log de subida de archivos sospechosos
   */
  static logSuspiciousFileUpload(event: {
    ip?: string;
    userId?: string;
    filename: string;
    fileType: string;
    fileSize: number;
    reason: string;
    blocked: boolean;
  }): void {
    this.logSecurityEvent({
      type: 'file_upload',
      severity: event.blocked ? 'high' : 'medium',
      ip: event.ip,
      userId: event.userId,
      details: {
        filename: event.filename,
        fileType: event.fileType,
        fileSize: event.fileSize,
        reason: event.reason,
        blocked: event.blocked
      }
    });
  }

  /**
   * Obtener estadísticas de seguridad
   */
  static getSecurityStats(): any {
    const now = new Date();
    const hoursSinceReset = Math.floor((now.getTime() - securityStats.lastReset.getTime()) / (1000 * 60 * 60));

    return {
      totalEvents: securityStats.totalEvents,
      attackAttempts: securityStats.attackAttempts,
      blockedAttacks: securityStats.blockedAttacks,
      authFailures: securityStats.authFailures,
      suspiciousIPCount: securityStats.suspiciousIPs.size,
      blockedIPCount: blockedIPs.size,
      hoursSinceReset,
      attackSuccessRate: securityStats.attackAttempts > 0 ? 
        ((securityStats.attackAttempts - securityStats.blockedAttacks) / securityStats.attackAttempts * 100).toFixed(2) + '%' : '0%',
      lastReset: securityStats.lastReset
    };
  }

  /**
   * Obtener IPs sospechosas
   */
  static getSuspiciousIPs(): string[] {
    return Array.from(securityStats.suspiciousIPs);
  }

  /**
   * Obtener IPs bloqueadas
   */
  static getBlockedIPs(): Array<{ip: string; blockedAt: Date; attempts: number; reason: string}> {
    return Array.from(blockedIPs.entries()).map(([ip, data]) => ({ ip, ...data }));
  }

  /**
   * Limpiar estadísticas (ejecutar cada día)
   */
  static resetStats(): void {
    securityStats.totalEvents = 0;
    securityStats.attackAttempts = 0;
    securityStats.blockedAttacks = 0;
    securityStats.authFailures = 0;
    securityStats.suspiciousIPs.clear();
    securityStats.lastReset = new Date();

    // Limpiar IPs bloqueadas que lleven más de 24 horas
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [ip, data] of blockedIPs.entries()) {
      if (data.blockedAt < yesterday) {
        blockedIPs.delete(ip);
      }
    }

    securityLogger.info('Security stats reset', { timestamp: new Date() });
  }

  /**
   * Verificar si una IP está bloqueada
   */
  static isIPBlocked(ip: string): boolean {
    const blocked = blockedIPs.get(ip);
    if (!blocked) return false;

    // Verificar si el bloqueo ha expirado (24 horas)
    const now = new Date();
    const hoursSinceBlocked = (now.getTime() - blocked.blockedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceBlocked > 24) {
      blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Crear alerta crítica
   */
  private static createCriticalAlert(event: any): void {
    const alert = {
      level: 'CRITICAL',
      event,
      timestamp: new Date(),
      message: `Critical security event detected: ${event.attackType || event.type}`,
      requiresImmedateAttention: true
    };

    securityLogger.error('CRITICAL SECURITY ALERT', alert);

    // TODO: Integrar con sistema de notificaciones (email, Slack, etc.)
    // this.sendAlertNotification(alert);
  }

  /**
   * Crear alerta general
   */
  private static createAlert(event: any): void {
    const alert = {
      level: 'HIGH',
      event,
      timestamp: new Date(),
      message: `High severity security event: ${event.type}`
    };

    securityLogger.warn('SECURITY ALERT', alert);
  }

  /**
   * Bloquear IP temporalmente
   */
  private static temporarilyBlockIP(ip: string, reason: string, details: string): void {
    const existing = blockedIPs.get(ip);
    blockedIPs.set(ip, {
      blockedAt: new Date(),
      attempts: existing ? existing.attempts + 1 : 1,
      reason: `${reason}: ${details}`
    });

    securityLogger.warn('IP Temporarily Blocked', {
      ip,
      reason,
      details,
      timestamp: new Date()
    });
  }

  /**
   * Analizar patrones de IP
   */
  private static analyzeIPPattern(ip: string, event: SecurityEvent): void {
    // Contar eventos por IP en la última hora
    // TODO: Implementar análisis más sofisticado con caché o base de datos
    
    if (event.severity === 'high' || event.severity === 'critical') {
      securityStats.suspiciousIPs.add(ip);
    }
  }

  /**
   * Analizar patrones de fallo de autenticación
   */
  private static analyzeAuthFailurePattern(ip: string, username: string): void {
    // TODO: Implementar análisis de patrones de fuerza bruta
    // Por ahora, agregar a IPs sospechosas después de varios fallos
    securityStats.suspiciousIPs.add(ip);
  }

  /**
   * Exportar logs para análisis forense
   */
  static exportLogs(startDate: Date, endDate: Date): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const logs: any[] = [];
      // TODO: Implementar exportación de logs filtrada por fecha
      // Por ahora retornar array vacío
      resolve(logs);
    });
  }
}

// Funciones auxiliares
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionId(): string {
  return `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Programar limpieza diaria de estadísticas
setInterval(() => {
  SecurityLogger.resetStats();
}, 24 * 60 * 60 * 1000); // 24 horas

export default SecurityLogger;

// Exportar función para compatibilidad con código existente
export const logSecurityEvent = (params: {
  eventType: any;
  severity: any;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  endpoint?: string;
  metadata?: any;
}) => {
  SecurityLogger.logSecurityEvent({
    type: params.eventType.toLowerCase().replace(/_/g, '_') as any,
    severity: params.severity.toLowerCase() as any,
    ip: params.ipAddress,
    userAgent: params.userAgent,
    userId: params.userId,
    endpoint: params.endpoint,
    details: {
      description: params.description,
      ...params.metadata
    }
  });
};
