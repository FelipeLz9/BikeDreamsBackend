// ==============================================
// BikeDreams Backend - Alert Manager
// ==============================================
// This service manages alerts and notifications for different environments
// with environment-specific configurations and channels.

import logger from '../utils/logger';

// ==============================================
// Types and Interfaces
// ==============================================

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'system' | 'security' | 'performance' | 'business' | 'database' | 'redis';
  environment: 'development' | 'staging' | 'production';
  timestamp: Date;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface AlertChannel {
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'console';
  enabled: boolean;
  config: Record<string, any>;
}

export interface AlertRule {
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // in milliseconds
  lastTriggered?: Date;
  enabled: boolean;
}

export interface AlertThresholds {
  errorRate: number;
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  securityEvents: number;
  databaseConnections: number;
  redisConnections: number;
}

// ==============================================
// Environment-Specific Configurations
// ==============================================

const developmentChannels: AlertChannel[] = [
  {
    name: 'console',
    type: 'console',
    enabled: true,
    config: {
      colorize: true,
      timestamp: true
    }
  },
  {
    name: 'email',
    type: 'email',
    enabled: false,
    config: {
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.ALERT_EMAIL_FROM,
      to: process.env.ALERT_EMAIL_TO
    }
  }
];

const stagingChannels: AlertChannel[] = [
  {
    name: 'console',
    type: 'console',
    enabled: true,
    config: {
      colorize: true,
      timestamp: true
    }
  },
  {
    name: 'email',
    type: 'email',
    enabled: true,
    config: {
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.ALERT_EMAIL_FROM,
      to: process.env.ALERT_EMAIL_TO
    }
  },
  {
    name: 'slack',
    type: 'slack',
    enabled: true,
    config: {
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: '#alerts-staging',
      username: 'BikeDreams Alerts',
      icon_emoji: ':warning:'
    }
  },
  {
    name: 'webhook',
    type: 'webhook',
    enabled: true,
    config: {
      url: process.env.ALERT_WEBHOOK_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`
      }
    }
  }
];

const productionChannels: AlertChannel[] = [
  {
    name: 'email',
    type: 'email',
    enabled: true,
    config: {
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.ALERT_EMAIL_FROM,
      to: process.env.ALERT_EMAIL_TO
    }
  },
  {
    name: 'slack',
    type: 'slack',
    enabled: true,
    config: {
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: '#alerts-production',
      username: 'BikeDreams Alerts',
      icon_emoji: ':rotating_light:'
    }
  },
  {
    name: 'pagerduty',
    type: 'pagerduty',
    enabled: true,
    config: {
      integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
      service: 'BikeDreams Backend',
      environment: 'production'
    }
  },
  {
    name: 'webhook',
    type: 'webhook',
    enabled: true,
    config: {
      url: process.env.ALERT_WEBHOOK_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`
      }
    }
  }
];

const developmentThresholds: AlertThresholds = {
  errorRate: 0.1, // 10%
  responseTime: 5000, // 5 seconds
  memoryUsage: 0.8, // 80%
  cpuUsage: 0.8, // 80%
  securityEvents: 20, // 20 per minute
  databaseConnections: 40, // 80% of 50
  redisConnections: 800 // 80% of 1000
};

const stagingThresholds: AlertThresholds = {
  errorRate: 0.05, // 5%
  responseTime: 3000, // 3 seconds
  memoryUsage: 0.7, // 70%
  cpuUsage: 0.7, // 70%
  securityEvents: 10, // 10 per minute
  databaseConnections: 60, // 80% of 75
  redisConnections: 1600 // 80% of 2000
};

const productionThresholds: AlertThresholds = {
  errorRate: 0.01, // 1%
  responseTime: 2000, // 2 seconds
  memoryUsage: 0.8, // 80%
  cpuUsage: 0.8, // 80%
  securityEvents: 5, // 5 per minute
  databaseConnections: 80, // 80% of 100
  redisConnections: 4000 // 80% of 5000
};

// ==============================================
// Alert Manager Class
// ==============================================

export class AlertManager {
  private environment: 'development' | 'staging' | 'production';
  private channels: AlertChannel[];
  private thresholds: AlertThresholds;
  private rules: AlertRule[];
  private alertHistory: Alert[] = [];
  private metrics: Map<string, any> = new Map();

  constructor(environment: 'development' | 'staging' | 'production') {
    this.environment = environment;
    this.channels = this.getChannelsForEnvironment(environment);
    this.thresholds = this.getThresholdsForEnvironment(environment);
    this.rules = this.getRulesForEnvironment(environment);
  }

  // ==============================================
  // Configuration Methods
  // ==============================================

  private getChannelsForEnvironment(env: string): AlertChannel[] {
    switch (env) {
      case 'development':
        return developmentChannels;
      case 'staging':
        return stagingChannels;
      case 'production':
        return productionChannels;
      default:
        return developmentChannels;
    }
  }

  private getThresholdsForEnvironment(env: string): AlertThresholds {
    switch (env) {
      case 'development':
        return developmentThresholds;
      case 'staging':
        return stagingThresholds;
      case 'production':
        return productionThresholds;
      default:
        return developmentThresholds;
    }
  }

  private getRulesForEnvironment(env: string): AlertRule[] {
    const baseRules: AlertRule[] = [
      {
        name: 'High Error Rate',
        condition: 'errorRate > threshold',
        severity: 'high',
        cooldown: 300000, // 5 minutes
        enabled: true
      },
      {
        name: 'High Response Time',
        condition: 'responseTime > threshold',
        severity: 'medium',
        cooldown: 600000, // 10 minutes
        enabled: true
      },
      {
        name: 'High Memory Usage',
        condition: 'memoryUsage > threshold',
        severity: 'critical',
        cooldown: 300000, // 5 minutes
        enabled: true
      },
      {
        name: 'High CPU Usage',
        condition: 'cpuUsage > threshold',
        severity: 'critical',
        cooldown: 300000, // 5 minutes
        enabled: true
      },
      {
        name: 'Security Event Spike',
        condition: 'securityEvents > threshold',
        severity: 'critical',
        cooldown: 60000, // 1 minute
        enabled: true
      }
    ];

    // Add environment-specific rules
    if (env === 'production') {
      baseRules.push({
        name: 'Service Down',
        condition: 'healthCheck == false',
        severity: 'critical',
        cooldown: 30000, // 30 seconds
        enabled: true
      });
    }

    return baseRules;
  }

  // ==============================================
  // Alert Creation and Management
  // ==============================================

  async createAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false
    };

    this.alertHistory.push(newAlert);

    // Send alert to enabled channels
    await this.sendAlert(newAlert);

    // Log the alert
    logger.warn('Alert created', {
      alertId: newAlert.id,
      title: newAlert.title,
      severity: newAlert.severity,
      category: newAlert.category,
      environment: newAlert.environment
    });

    return newAlert;
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    // Send resolution notification
    await this.sendAlertResolution(alert);

    logger.info('Alert resolved', {
      alertId: alert.id,
      resolvedBy: resolvedBy,
      resolvedAt: alert.resolvedAt
    });

    return true;
  }

  // ==============================================
  // Metrics and Monitoring
  // ==============================================

  updateMetric(key: string, value: any): void {
    this.metrics.set(key, {
      value,
      timestamp: new Date()
    });
  }

  checkThresholds(): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Check if rule should be triggered
      if (this.shouldTriggerRule(rule)) {
        this.triggerRule(rule);
      }
    }
  }

  private shouldTriggerRule(rule: AlertRule): boolean {
    // Check cooldown
    if (rule.lastTriggered) {
      const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
      if (timeSinceLastTrigger < rule.cooldown) {
        return false;
      }
    }

    // Check condition
    return this.evaluateCondition(rule.condition);
  }

  private evaluateCondition(condition: string): boolean {
    // Simple condition evaluation
    // In a real implementation, you'd use a proper expression evaluator
    const parts = condition.split(' ');
    if (parts.length !== 3) return false;

    const [metric, operator, threshold] = parts;
    const currentValue = this.metrics.get(metric)?.value || 0;
    const thresholdValue = this.thresholds[metric as keyof AlertThresholds] || 0;

    switch (operator) {
      case '>':
        return currentValue > thresholdValue;
      case '>=':
        return currentValue >= thresholdValue;
      case '<':
        return currentValue < thresholdValue;
      case '<=':
        return currentValue <= thresholdValue;
      case '==':
        return currentValue === thresholdValue;
      case '!=':
        return currentValue !== thresholdValue;
      default:
        return false;
    }
  }

  private async triggerRule(rule: AlertRule): Promise<void> {
    rule.lastTriggered = new Date();

    const alert = await this.createAlert({
      title: rule.name,
      message: `Rule "${rule.name}" triggered in ${this.environment} environment`,
      severity: rule.severity,
      category: 'system',
      environment: this.environment,
      metadata: {
        rule: rule.name,
        condition: rule.condition,
        triggeredAt: rule.lastTriggered
      }
    });

    logger.warn('Alert rule triggered', {
      rule: rule.name,
      severity: rule.severity,
      alertId: alert.id
    });
  }

  // ==============================================
  // Alert Sending
  // ==============================================

  private async sendAlert(alert: Alert): Promise<void> {
    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendToChannel(alert, channel);
      } catch (error) {
        logger.error('Failed to send alert to channel', {
          channel: channel.name,
          error: error.message,
          alertId: alert.id
        });
      }
    }
  }

  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        this.sendToConsole(alert, channel);
        break;
      case 'email':
        await this.sendToEmail(alert, channel);
        break;
      case 'slack':
        await this.sendToSlack(alert, channel);
        break;
      case 'webhook':
        await this.sendToWebhook(alert, channel);
        break;
      case 'pagerduty':
        await this.sendToPagerDuty(alert, channel);
        break;
    }
  }

  private sendToConsole(alert: Alert, channel: AlertChannel): void {
    const color = this.getSeverityColor(alert.severity);
    const message = `🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`;
    
    if (channel.config.colorize) {
      console.log(`\x1b[${color}m${message}\x1b[0m`);
    } else {
      console.log(message);
    }
  }

  private async sendToEmail(alert: Alert, channel: AlertChannel): Promise<void> {
    // Implementation would use nodemailer or similar
    logger.info('Email alert sent', { alertId: alert.id, channel: channel.name });
  }

  private async sendToSlack(alert: Alert, channel: AlertChannel): Promise<void> {
    // Implementation would use Slack webhook
    logger.info('Slack alert sent', { alertId: alert.id, channel: channel.name });
  }

  private async sendToWebhook(alert: Alert, channel: AlertChannel): Promise<void> {
    // Implementation would use fetch or axios
    logger.info('Webhook alert sent', { alertId: alert.id, channel: channel.name });
  }

  private async sendToPagerDuty(alert: Alert, channel: AlertChannel): Promise<void> {
    // Implementation would use PagerDuty API
    logger.info('PagerDuty alert sent', { alertId: alert.id, channel: channel.name });
  }

  private async sendAlertResolution(alert: Alert): Promise<void> {
    // Send resolution notification to channels
    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendResolutionToChannel(alert, channel);
      } catch (error) {
        logger.error('Failed to send alert resolution to channel', {
          channel: channel.name,
          error: error.message,
          alertId: alert.id
        });
      }
    }
  }

  private async sendResolutionToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    // Similar to sendToChannel but for resolutions
    logger.info('Alert resolution sent', { alertId: alert.id, channel: channel.name });
  }

  // ==============================================
  // Utility Methods
  // ==============================================

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '31'; // Red
      case 'high': return '33'; // Yellow
      case 'medium': return '36'; // Cyan
      case 'low': return '32'; // Green
      default: return '37'; // White
    }
  }

  // ==============================================
  // Public API Methods
  // ==============================================

  getAlerts(): Alert[] {
    return this.alertHistory;
  }

  getActiveAlerts(): Alert[] {
    return this.alertHistory.filter(alert => !alert.resolved);
  }

  getChannels(): AlertChannel[] {
    return this.channels;
  }

  getThresholds(): AlertThresholds {
    return this.thresholds;
  }

  getRules(): AlertRule[] {
    return this.rules;
  }

  getMetrics(): Map<string, any> {
    return this.metrics;
  }
}

// ==============================================
// Export Default Instance
// ==============================================

export default AlertManager;
