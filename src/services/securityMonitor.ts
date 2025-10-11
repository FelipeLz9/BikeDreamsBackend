import { SecurityLogger } from './securityLogger.js';
import { EventEmitter } from 'events';

// Configuración de alertas
const ALERT_THRESHOLDS = {
  ATTACKS_PER_HOUR: 10,
  AUTH_FAILURES_PER_HOUR: 50,
  SUSPICIOUS_IPS_THRESHOLD: 5,
  CRITICAL_EVENTS_PER_HOUR: 3,
  HIGH_RISK_SCORE_THRESHOLD: 8
};

// Configuración de notificaciones
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SECURITY_EMAIL = process.env.SECURITY_ALERT_EMAIL || 'security@example.com';

// Interfaces
interface AlertRule {
  id: string;
  name: string;
  condition: (stats: any, events: any[]) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number;
  lastTriggered?: Date;
  enabled: boolean;
  notificationChannels: ('email' | 'slack' | 'console')[];
}

interface SecurityMetrics {
  requestsPerMinute: number;
  attacksPerMinute: number;
  authFailuresPerMinute: number;
  uniqueIPsPerMinute: number;
  avgResponseTime: number;
  errorRate: number;
  suspiciousActivityScore: number;
}

interface ThreatLevel {
  level: 'green' | 'yellow' | 'orange' | 'red' | 'critical';
  score: number;
  reasons: string[];
  recommendedActions: string[];
}

export class SecurityMonitor extends EventEmitter {
  private static instance: SecurityMonitor;
  private isMonitoring = false;
  private metrics: SecurityMetrics[] = [];
  private recentEvents: any[] = [];
  private alertRules: AlertRule[] = [];
  private emailTransporter: any | null = null;
  private slackWebhook: any | null = null;

  constructor() {
    super();
    this.initializeNotificationChannels();
    this.setupDefaultAlertRules();
  }

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * Inicializar canales de notificación
   */
  private initializeNotificationChannels(): void {
    // Configurar email - Deshabilitado por ahora (requiere nodemailer)
    /*
    try {
      if (EMAIL_CONFIG.auth.user && EMAIL_CONFIG.auth.pass) {
        this.emailTransporter = nodemailer.createTransporter(EMAIL_CONFIG);
      }
    } catch (error) {
      console.warn('Could not initialize email notifications:', error);
    }
    */

    // Configurar Slack - Deshabilitado por ahora (requiere @slack/webhook)
    /*
    try {
      if (SLACK_WEBHOOK_URL) {
        this.slackWebhook = new WebhookClient(SLACK_WEBHOOK_URL);
      }
    } catch (error) {
      console.warn('Could not initialize Slack notifications:', error);
    }
    */

    console.log('📞 Notification channels: Console alerts only (email/slack disabled)');
  }

  /**
   * Configurar reglas de alerta por defecto
   */
  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high_attack_rate',
        name: 'Alto número de ataques por hora',
        condition: (stats) => stats.attackAttempts >= ALERT_THRESHOLDS.ATTACKS_PER_HOUR,
        severity: 'high',
        cooldownMinutes: 30,
        enabled: true,
        notificationChannels: ['console']
      },
      {
        id: 'brute_force_detected',
        name: 'Posible ataque de fuerza bruta detectado',
        condition: (stats) => stats.authFailures >= ALERT_THRESHOLDS.AUTH_FAILURES_PER_HOUR,
        severity: 'high',
        cooldownMinutes: 15,
        enabled: true,
        notificationChannels: ['console']
      },
      {
        id: 'multiple_suspicious_ips',
        name: 'Múltiples IPs sospechosas detectadas',
        condition: (stats) => stats.suspiciousIPCount >= ALERT_THRESHOLDS.SUSPICIOUS_IPS_THRESHOLD,
        severity: 'medium',
        cooldownMinutes: 60,
        enabled: true,
        notificationChannels: ['console']
      },
      {
        id: 'critical_events_spike',
        name: 'Pico de eventos críticos',
        condition: (stats, events) => {
          const criticalEvents = events.filter(e => e.severity === 'critical');
          return criticalEvents.length >= ALERT_THRESHOLDS.CRITICAL_EVENTS_PER_HOUR;
        },
        severity: 'critical',
        cooldownMinutes: 5,
        enabled: true,
        notificationChannels: ['console']
      },
      {
        id: 'data_breach_attempt',
        name: 'Posible intento de violación de datos',
        condition: (stats, events) => {
          const dataBreachPatterns = events.filter(e => 
            e.attackType === 'sql_injection' || 
            e.attackType === 'path_traversal' ||
            (e.riskScore && e.riskScore >= ALERT_THRESHOLDS.HIGH_RISK_SCORE_THRESHOLD)
          );
          return dataBreachPatterns.length > 0;
        },
        severity: 'critical',
        cooldownMinutes: 1,
        enabled: true,
        notificationChannels: ['console']
      },
      {
        id: 'unusual_traffic_pattern',
        name: 'Patrón de tráfico inusual',
        condition: (stats, events) => {
          if (this.metrics.length < 10) return false;
          const avgRequests = this.metrics.slice(-10).reduce((sum, m) => sum + m.requestsPerMinute, 0) / 10;
          const currentRequests = this.metrics[this.metrics.length - 1]?.requestsPerMinute || 0;
          return currentRequests > avgRequests * 3; // 300% del promedio
        },
        severity: 'medium',
        cooldownMinutes: 30,
        enabled: true,
        notificationChannels: ['console']
      }
    ];
  }

  /**
   * Iniciar monitoreo
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🛡️  Security monitoring started');

    // Monitoreo cada minuto
    setInterval(() => {
      this.collectMetrics();
      this.evaluateAlertRules();
      this.cleanupOldData();
    }, 60 * 1000); // 1 minuto

    // Análisis más profundo cada 5 minutos
    setInterval(() => {
      this.performDeepAnalysis();
    }, 5 * 60 * 1000); // 5 minutos

    // Reporte de estado cada hora
    setInterval(() => {
      this.generateSecurityReport();
    }, 60 * 60 * 1000); // 1 hora
  }

  /**
   * Detener monitoreo
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('🛑 Security monitoring stopped');
  }

  /**
   * Recopilar métricas actuales
   */
  private collectMetrics(): void {
    const stats = SecurityLogger.getSecurityStats();
    
    // Calcular métricas adicionales
    const currentMetric: SecurityMetrics = {
      requestsPerMinute: this.calculateRequestRate(),
      attacksPerMinute: stats.attackAttempts,
      authFailuresPerMinute: stats.authFailures,
      uniqueIPsPerMinute: stats.suspiciousIPCount,
      avgResponseTime: this.calculateAvgResponseTime(),
      errorRate: this.calculateErrorRate(),
      suspiciousActivityScore: this.calculateSuspiciousActivityScore(stats)
    };

    this.metrics.push(currentMetric);

    // Limitar a las últimas 60 métricas (1 hora)
    if (this.metrics.length > 60) {
      this.metrics = this.metrics.slice(-60);
    }
  }

  /**
   * Evaluar reglas de alerta
   */
  private evaluateAlertRules(): void {
    let stats;
    try {
      stats = SecurityLogger.getSecurityStats();
      if (!stats) return; // Skip evaluation if no stats available
    } catch (error) {
      console.warn('SecurityLogger error during alert evaluation:', error);
      return; // Skip evaluation on error
    }
    const now = new Date();

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Verificar cooldown
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = now.getTime() - rule.lastTriggered.getTime();
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (timeSinceLastTrigger < cooldownMs) continue;
      }

      // Evaluar condición
      if (rule.condition(stats, this.recentEvents)) {
        this.triggerAlert(rule, stats);
        rule.lastTriggered = now;
      }
    }
  }

  /**
   * Activar alerta
   */
  private async triggerAlert(rule: AlertRule, stats: any): Promise<void> {
    const alert = {
      rule: rule.name,
      severity: rule.severity,
      timestamp: new Date(),
      stats,
      threatLevel: this.calculateThreatLevel(),
      message: this.generateAlertMessage(rule, stats)
    };

    console.log(`🚨 SECURITY ALERT [${rule.severity.toUpperCase()}]: ${rule.name}`);

    // Emitir evento
    this.emit('securityAlert', alert);

    // Enviar notificaciones
    for (const channel of rule.notificationChannels) {
      switch (channel) {
        case 'email':
          await this.sendEmailAlert(alert);
          break;
        case 'slack':
          await this.sendSlackAlert(alert);
          break;
        case 'console':
          this.sendConsoleAlert(alert);
          break;
      }
    }

    // Log de la alerta
    SecurityLogger.logSecurityEvent({
      type: 'suspicious_activity',
      severity: rule.severity as any,
      details: {
        alertRule: rule.id,
        alertName: rule.name,
        triggeredBy: stats,
        threatLevel: alert.threatLevel
      }
    });
  }

  /**
   * Calcular nivel de amenaza actual
   */
  private calculateThreatLevel(): ThreatLevel {
    let stats;
    try {
      stats = SecurityLogger.getSecurityStats();
      if (!stats) {
        stats = {
          attackAttempts: 0,
          authFailures: 0,
          suspiciousIPCount: 0,
          blockedIPCount: 0
        };
      }
    } catch (error) {
      console.warn('SecurityLogger error, using default stats:', error);
      stats = {
        attackAttempts: 0,
        authFailures: 0,
        suspiciousIPCount: 0,
        blockedIPCount: 0
      };
    }
    const recentMetrics = this.metrics.slice(-10);
    
    let score = 0;
    const reasons: string[] = [];
    const actions: string[] = [];

    // Evaluar factores de riesgo
    if (stats.attackAttempts > 5) {
      score += 2;
      reasons.push(`${stats.attackAttempts} intentos de ataque detectados`);
    }

    if (stats.authFailures > 20) {
      score += 2;
      reasons.push(`${stats.authFailures} fallos de autenticación`);
    }

    if (stats.suspiciousIPCount > 3) {
      score += 1;
      reasons.push(`${stats.suspiciousIPCount} IPs sospechosas`);
    }

    if (stats.blockedIPCount > 0) {
      score += 1;
      reasons.push(`${stats.blockedIPCount} IPs bloqueadas`);
    }

    // Evaluar métricas recientes
    if (recentMetrics.length > 0) {
      const avgSuspiciousScore = recentMetrics.reduce((sum, m) => sum + m.suspiciousActivityScore, 0) / recentMetrics.length;
      if (avgSuspiciousScore > 7) {
        score += 2;
        reasons.push('Alta puntuación de actividad sospechosa');
      }
    }

    // Determinar nivel y acciones
    let level: ThreatLevel['level'];
    
    if (score >= 8) {
      level = 'critical';
      actions.push('Activar protocolo de emergencia', 'Bloquear IPs sospechosas', 'Contactar equipo de seguridad');
    } else if (score >= 6) {
      level = 'red';
      actions.push('Aumentar monitoreo', 'Revisar logs inmediatamente', 'Considerar bloqueo de IPs');
    } else if (score >= 4) {
      level = 'orange';
      actions.push('Monitorear de cerca', 'Revisar patrones de actividad');
    } else if (score >= 2) {
      level = 'yellow';
      actions.push('Mantener vigilancia', 'Revisar logs periódicamente');
    } else {
      level = 'green';
      actions.push('Continuar monitoreo normal');
    }

    return { level, score, reasons, recommendedActions: actions };
  }

  /**
   * Análisis profundo cada 5 minutos
   */
  private performDeepAnalysis(): void {
    const threatLevel = this.calculateThreatLevel();
    
    // Si el nivel de amenaza es alto, realizar análisis adicionales
    if (threatLevel.level === 'red' || threatLevel.level === 'critical') {
      this.performEmergencyAnalysis();
    }

    // Detectar anomalías en patrones de tráfico
    this.detectTrafficAnomalies();

    // Analizar correlaciones entre eventos
    this.analyzeEventCorrelations();
  }

  /**
   * Análisis de emergencia
   */
  private performEmergencyAnalysis(): void {
    const suspiciousIPs = SecurityLogger.getSuspiciousIPs();
    const blockedIPs = SecurityLogger.getBlockedIPs();

    console.log('🔥 EMERGENCY SECURITY ANALYSIS INITIATED');
    console.log(`Suspicious IPs: ${suspiciousIPs.length}`);
    console.log(`Blocked IPs: ${blockedIPs.length}`);

    // TODO: Implementar análisis más sofisticado
    // - Análisis de geolocalización de IPs
    // - Correlación con bases de datos de amenazas
    // - Análisis de patrones de comportamiento
  }

  /**
   * Detectar anomalías en tráfico
   */
  private detectTrafficAnomalies(): void {
    if (this.metrics.length < 20) return;

    const recentMetrics = this.metrics.slice(-20);
    const avgRequests = recentMetrics.reduce((sum, m) => sum + m.requestsPerMinute, 0) / recentMetrics.length;
    const currentRequests = this.metrics[this.metrics.length - 1].requestsPerMinute;

    // Detectar picos de tráfico anómalos
    if (currentRequests > avgRequests * 2.5) {
      SecurityLogger.logSuspiciousActivity({
        description: 'Anomalous traffic spike detected',
        details: {
          currentRequests,
          averageRequests: avgRequests,
          anomalyFactor: currentRequests / avgRequests
        },
        riskScore: 6
      });
    }
  }

  /**
   * Analizar correlaciones entre eventos
   */
  private analyzeEventCorrelations(): void {
    // TODO: Implementar análisis de correlación
    // - Patrones de tiempo de ataques
    // - Correlación geográfica
    // - Patrones de user agents
  }

  /**
   * Generar reporte de seguridad
   */
  private generateSecurityReport(): void {
    const stats = SecurityLogger.getSecurityStats();
    const threatLevel = this.calculateThreatLevel();
    
    const report = {
      timestamp: new Date(),
      period: '1 hour',
      overview: {
        threatLevel: threatLevel.level,
        threatScore: threatLevel.score,
        totalEvents: stats.totalEvents,
        attackAttempts: stats.attackAttempts,
        blockedAttacks: stats.blockedAttacks,
        authFailures: stats.authFailures,
        suspiciousIPs: stats.suspiciousIPCount,
        blockedIPs: stats.blockedIPCount
      },
      recommendations: threatLevel.recommendedActions,
      topRisks: threatLevel.reasons
    };

    console.log('📊 HOURLY SECURITY REPORT:', JSON.stringify(report, null, 2));

    // Si el nivel de amenaza es alto, enviar reporte por email
    if (threatLevel.level === 'red' || threatLevel.level === 'critical') {
      this.sendSecurityReport(report);
    }
  }

  /**
   * Limpiar datos antiguos
   */
  private cleanupOldData(): void {
    // Mantener solo eventos de la última hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.recentEvents = this.recentEvents.filter(event => 
      new Date(event.timestamp) > oneHourAgo
    );
  }

  /**
   * Calcular métricas auxiliares
   */
  private calculateRequestRate(): number {
    // TODO: Integrar con métricas reales del servidor
    return Math.floor(Math.random() * 100); // Placeholder
  }

  private calculateAvgResponseTime(): number {
    // TODO: Integrar con métricas reales
    return Math.floor(Math.random() * 1000); // Placeholder
  }

  private calculateErrorRate(): number {
    // TODO: Integrar con métricas reales
    return Math.random() * 10; // Placeholder
  }

  private calculateSuspiciousActivityScore(stats: any): number {
    let score = 0;
    
    if (stats.attackAttempts > 0) score += stats.attackAttempts * 0.5;
    if (stats.authFailures > 0) score += stats.authFailures * 0.2;
    if (stats.suspiciousIPCount > 0) score += stats.suspiciousIPCount * 0.3;
    
    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Generar mensaje de alerta
   */
  private generateAlertMessage(rule: AlertRule, stats: any): string {
    const threatLevel = this.calculateThreatLevel();
    
    return `
🚨 ALERTA DE SEGURIDAD: ${rule.name}

Severidad: ${rule.severity.toUpperCase()}
Nivel de Amenaza: ${threatLevel.level.toUpperCase()} (${threatLevel.score}/10)

Estadísticas Actuales:
- Intentos de ataque: ${stats.attackAttempts}
- Fallos de autenticación: ${stats.authFailures}
- IPs sospechosas: ${stats.suspiciousIPCount}
- IPs bloqueadas: ${stats.blockedIPCount}

Razones del riesgo:
${threatLevel.reasons.map(r => `- ${r}`).join('\n')}

Acciones recomendadas:
${threatLevel.recommendedActions.map(a => `- ${a}`).join('\n')}

Timestamp: ${new Date().toISOString()}
    `.trim();
  }

  /**
   * Enviar alerta por email
   */
  private async sendEmailAlert(alert: any): Promise<void> {
    if (!this.emailTransporter) return;

    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'security@example.com',
        to: SECURITY_EMAIL,
        subject: `🚨 Alerta de Seguridad [${alert.severity.toUpperCase()}]: ${alert.rule}`,
        text: alert.message,
        html: alert.message.replace(/\n/g, '<br>')
      });

      console.log(`📧 Security alert sent via email`);
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Enviar alerta por Slack
   */
  private async sendSlackAlert(alert: any): Promise<void> {
    if (!this.slackWebhook) return;

    const color = {
      low: '#36a64f',
      medium: '#ff9500',
      high: '#ff0000',
      critical: '#8B0000'
    }[alert.severity] || '#ff0000';

    try {
      await this.slackWebhook.send({
        text: `🚨 Alerta de Seguridad: ${alert.rule}`,
        attachments: [{
          color,
          fields: [
            {
              title: 'Severidad',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Nivel de Amenaza',
              value: `${alert.threatLevel.level.toUpperCase()} (${alert.threatLevel.score}/10)`,
              short: true
            },
            {
              title: 'Detalles',
              value: alert.message.substring(0, 1000),
              short: false
            }
          ],
          ts: Math.floor(alert.timestamp.getTime() / 1000)
        }]
      });

      console.log(`💬 Security alert sent via Slack`);
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Enviar alerta a consola
   */
  private sendConsoleAlert(alert: any): void {
    const colors = {
      low: '\x1b[32m',     // Verde
      medium: '\x1b[33m',  // Amarillo
      high: '\x1b[31m',    // Rojo
      critical: '\x1b[35m' // Magenta
    };

    const color = colors[alert.severity as keyof typeof colors] || '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`${color}${alert.message}${reset}`);
  }

  /**
   * Enviar reporte de seguridad
   */
  private async sendSecurityReport(report: any): Promise<void> {
    // Enviar por email si está configurado
    if (this.emailTransporter) {
      const subject = `📊 Reporte de Seguridad - Nivel ${report.overview.threatLevel.toUpperCase()}`;
      const message = JSON.stringify(report, null, 2);

      try {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'security@example.com',
          to: SECURITY_EMAIL,
          subject,
          text: message,
          html: `<pre>${message}</pre>`
        });
      } catch (error) {
        console.error('Failed to send security report:', error);
      }
    }
  }

  /**
   * Obtener estado del monitoreo
   */
  getMonitoringStatus(): any {
    return {
      isMonitoring: this.isMonitoring,
      currentThreatLevel: this.calculateThreatLevel(),
      activeAlertRules: this.alertRules.filter(r => r.enabled).length,
      recentMetrics: this.metrics.slice(-5),
      stats: SecurityLogger.getSecurityStats()
    };
  }

  /**
   * Configurar regla de alerta personalizada
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    console.log(`Alert rule added: ${rule.name}`);
  }

  /**
   * Habilitar/deshabilitar regla de alerta
   */
  toggleAlertRule(ruleId: string, enabled: boolean): void {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      console.log(`Alert rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }
}

// Exportar instancia singleton
export const securityMonitor = SecurityMonitor.getInstance();
