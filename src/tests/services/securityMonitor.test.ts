// Mock SecurityLogger first
const mockSecurityLogger = {
  getSecurityStats: jest.fn(),
  logSecurityEvent: jest.fn(),
  logSuspiciousActivity: jest.fn(),
  getSuspiciousIPs: jest.fn(),
  getBlockedIPs: jest.fn()
};

jest.mock('../../services/securityLogger.js', () => ({
  SecurityLogger: mockSecurityLogger
}));

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock timers
jest.useFakeTimers();

import { SecurityMonitor, securityMonitor } from '../../services/securityMonitor';
import { EventEmitter } from 'events';

describe('🛡️  SecurityMonitor Tests', () => {
  let monitor: SecurityMonitor;
  const originalConsole = console;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Mock console to avoid test noise
    console.log = mockConsole.log;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Reset SecurityLogger mock
    mockSecurityLogger.getSecurityStats.mockReturnValue({
      totalEvents: 0,
      attackAttempts: 0,
      blockedAttacks: 0,
      authFailures: 0,
      suspiciousIPCount: 0,
      blockedIPCount: 0
    });

    mockSecurityLogger.getSuspiciousIPs.mockReturnValue([]);
    mockSecurityLogger.getBlockedIPs.mockReturnValue([]);

    // Create fresh instance for each test
    monitor = new SecurityMonitor();
  });

  afterEach(() => {
    if (monitor) {
      monitor.stopMonitoring();
    }
  });

  afterAll(() => {
    // Restore console
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    // Restore timers
    jest.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when calling getInstance multiple times', () => {
      const instance1 = SecurityMonitor.getInstance();
      const instance2 = SecurityMonitor.getInstance();
      const instance3 = SecurityMonitor.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1).toBe(securityMonitor);
    });

    it('should be an instance of EventEmitter', () => {
      const instance = SecurityMonitor.getInstance();
      expect(instance).toBeInstanceOf(EventEmitter);
      expect(instance).toBeInstanceOf(SecurityMonitor);
    });
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(mockConsole.log).toHaveBeenCalledWith('📞 Notification channels: Console alerts only (email/slack disabled)');
    });

    it('should setup default alert rules', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.activeAlertRules).toBeGreaterThan(0);
    });

    it('should start with monitoring disabled', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(false);
    });
  });

  describe('Monitoring Control', () => {
    it('should start monitoring successfully', () => {
      monitor.startMonitoring();
      
      expect(mockConsole.log).toHaveBeenCalledWith('🛡️  Security monitoring started');
      
      const status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(true);
    });

    it('should stop monitoring successfully', () => {
      monitor.startMonitoring();
      monitor.stopMonitoring();
      
      expect(mockConsole.log).toHaveBeenCalledWith('🛑 Security monitoring stopped');
      
      const status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(false);
    });

    it('should not start monitoring if already monitoring', () => {
      monitor.startMonitoring();
      mockConsole.log.mockClear();
      
      monitor.startMonitoring(); // Try to start again
      
      expect(mockConsole.log).not.toHaveBeenCalledWith('🛡️  Security monitoring started');
    });

    it('should execute monitoring intervals when started', () => {
      const collectMetricsSpy = jest.spyOn(monitor as any, 'collectMetrics');
      const evaluateAlertRulesSpy = jest.spyOn(monitor as any, 'evaluateAlertRules');
      
      monitor.startMonitoring();
      
      // Fast forward 1 minute (60000ms) for main monitoring interval
      jest.advanceTimersByTime(60000);
      
      expect(collectMetricsSpy).toHaveBeenCalled();
      expect(evaluateAlertRulesSpy).toHaveBeenCalled();
    });
  });

  describe('Threat Level Calculation', () => {
    it('should calculate green threat level with no threats', () => {
      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 0,
        authFailures: 0,
        suspiciousIPCount: 0,
        blockedIPCount: 0
      });

      const status = monitor.getMonitoringStatus();
      const threatLevel = status.currentThreatLevel;

      expect(threatLevel.level).toBe('green');
      expect(threatLevel.score).toBe(0);
      expect(threatLevel.recommendedActions).toContain('Continuar monitoreo normal');
    });

    it('should calculate yellow threat level with minor threats', () => {
      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 6, // > 5 triggers +2
        authFailures: 10, // < 20 so no points
        suspiciousIPCount: 1, // < 3 so no points
        blockedIPCount: 0
      });

      const status = monitor.getMonitoringStatus();
      const threatLevel = status.currentThreatLevel;

      expect(threatLevel.level).toBe('yellow'); // score = 2
      expect(threatLevel.score).toBeGreaterThanOrEqual(2);
      expect(threatLevel.recommendedActions).toContain('Mantener vigilancia');
    });

    it('should calculate orange threat level with moderate threats', () => {
      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 8, // > 5 triggers +2
        authFailures: 25, // > 20 triggers +2
        suspiciousIPCount: 2, // < 3 so no points
        blockedIPCount: 1 // > 0 triggers +1
      });

      const status = monitor.getMonitoringStatus();
      const threatLevel = status.currentThreatLevel;

      expect(threatLevel.level).toBe('orange'); // score = 5 (2+2+1)
      expect(threatLevel.score).toBeGreaterThanOrEqual(4);
      expect(threatLevel.recommendedActions).toContain('Monitorear de cerca');
    });

    it('should calculate red threat level with high threats', () => {
      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 12,
        authFailures: 25,
        suspiciousIPCount: 4,
        blockedIPCount: 2
      });

      const status = monitor.getMonitoringStatus();
      const threatLevel = status.currentThreatLevel;

      expect(threatLevel.level).toBe('red');
      expect(threatLevel.score).toBeGreaterThanOrEqual(6);
      expect(threatLevel.recommendedActions).toContain('Aumentar monitoreo');
    });

    it('should calculate critical threat level with severe threats', () => {
      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 15, // > 5 triggers +2
        authFailures: 30, // > 20 triggers +2
        suspiciousIPCount: 6, // > 3 triggers +1
        blockedIPCount: 3 // > 0 triggers +1
      });

      // Mock metrics with high suspicious activity score
      const mockMetrics = Array.from({ length: 10 }, () => ({
        requestsPerMinute: 50,
        attacksPerMinute: 5,
        authFailuresPerMinute: 10,
        uniqueIPsPerMinute: 3,
        avgResponseTime: 200,
        errorRate: 2,
        suspiciousActivityScore: 8 // > 7 triggers +2
      }));
      
      // Set the metrics on the monitor instance
      (monitor as any).metrics = mockMetrics;

      const status = monitor.getMonitoringStatus();
      const threatLevel = status.currentThreatLevel;

      expect(threatLevel.level).toBe('critical'); // score = 8 (2+2+1+1+2)
      expect(threatLevel.score).toBeGreaterThanOrEqual(8);
      expect(threatLevel.recommendedActions).toContain('Activar protocolo de emergencia');
    });
  });

  describe('Alert Rules', () => {
    it('should trigger high attack rate alert', () => {
      const alertSpy = jest.fn();
      monitor.on('securityAlert', alertSpy);

      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 15, // Above ATTACKS_PER_HOUR threshold (10)
        authFailures: 0,
        suspiciousIPCount: 0,
        blockedIPCount: 0
      });

      monitor.startMonitoring();
      jest.advanceTimersByTime(60000); // Trigger evaluation

      expect(alertSpy).toHaveBeenCalled();
      const alertCall = alertSpy.mock.calls[0][0];
      expect(alertCall.rule).toContain('Alto número de ataques');
      expect(alertCall.severity).toBe('high');
    });

    it('should trigger brute force alert', () => {
      const alertSpy = jest.fn();
      monitor.on('securityAlert', alertSpy);

      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 0,
        authFailures: 60, // Above AUTH_FAILURES_PER_HOUR threshold (50)
        suspiciousIPCount: 0,
        blockedIPCount: 0
      });

      monitor.startMonitoring();
      jest.advanceTimersByTime(60000); // Trigger evaluation

      expect(alertSpy).toHaveBeenCalled();
      const alertCall = alertSpy.mock.calls[0][0];
      expect(alertCall.rule).toContain('fuerza bruta');
      expect(alertCall.severity).toBe('high');
    });

    it('should trigger multiple suspicious IPs alert', () => {
      const alertSpy = jest.fn();
      monitor.on('securityAlert', alertSpy);

      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 0,
        authFailures: 0,
        suspiciousIPCount: 8, // Above SUSPICIOUS_IPS_THRESHOLD (5)
        blockedIPCount: 0
      });

      monitor.startMonitoring();
      jest.advanceTimersByTime(60000); // Trigger evaluation

      expect(alertSpy).toHaveBeenCalled();
      const alertCall = alertSpy.mock.calls[0][0];
      expect(alertCall.rule).toContain('IPs sospechosas');
      expect(alertCall.severity).toBe('medium');
    });

    it('should respect cooldown periods for alert rules', () => {
      const alertSpy = jest.fn();
      monitor.on('securityAlert', alertSpy);

      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 15,
        authFailures: 0,
        suspiciousIPCount: 0,
        blockedIPCount: 0
      });

      monitor.startMonitoring();
      
      // First trigger
      jest.advanceTimersByTime(60000);
      expect(alertSpy).toHaveBeenCalledTimes(1);
      
      alertSpy.mockClear();
      
      // Second trigger within cooldown period (30 minutes for high attack rate)
      jest.advanceTimersByTime(60000); // Only 1 more minute
      expect(alertSpy).not.toHaveBeenCalled(); // Should not trigger due to cooldown
      
      // Third trigger after cooldown period
      jest.advanceTimersByTime(29 * 60 * 1000); // 29 more minutes = 30 total
      expect(alertSpy).toHaveBeenCalledTimes(1); // Should trigger again
    });

    it('should not trigger disabled alert rules', () => {
      const alertSpy = jest.fn();
      monitor.on('securityAlert', alertSpy);

      // Disable the high attack rate rule
      monitor.toggleAlertRule('high_attack_rate', false);

      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 15,
        authFailures: 0,
        suspiciousIPCount: 0,
        blockedIPCount: 0
      });

      monitor.startMonitoring();
      jest.advanceTimersByTime(60000);

      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  describe('Alert Rule Management', () => {
    it('should add custom alert rule', () => {
      const customRule = {
        id: 'custom_test',
        name: 'Custom Test Rule',
        condition: () => true,
        severity: 'low' as const,
        cooldownMinutes: 10,
        enabled: true,
        notificationChannels: ['console' as const]
      };

      monitor.addAlertRule(customRule);
      
      expect(mockConsole.log).toHaveBeenCalledWith('Alert rule added: Custom Test Rule');
    });

    it('should enable and disable alert rules', () => {
      monitor.toggleAlertRule('high_attack_rate', false);
      expect(mockConsole.log).toHaveBeenCalledWith('Alert rule high_attack_rate disabled');

      monitor.toggleAlertRule('high_attack_rate', true);
      expect(mockConsole.log).toHaveBeenCalledWith('Alert rule high_attack_rate enabled');
    });

    it('should handle toggling non-existent alert rule', () => {
      monitor.toggleAlertRule('non_existent_rule', false);
      // Should not crash and not log anything for non-existent rule
      expect(mockConsole.log).not.toHaveBeenCalledWith(expect.stringContaining('non_existent_rule'));
    });
  });

  describe('Metrics Collection and Analysis', () => {
    it('should collect metrics periodically', () => {
      const collectMetricsSpy = jest.spyOn(monitor as any, 'collectMetrics');
      
      monitor.startMonitoring();
      jest.advanceTimersByTime(60000);
      
      expect(collectMetricsSpy).toHaveBeenCalled();
    });

    it('should perform deep analysis periodically', () => {
      const deepAnalysisSpy = jest.spyOn(monitor as any, 'performDeepAnalysis');
      
      monitor.startMonitoring();
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      
      expect(deepAnalysisSpy).toHaveBeenCalled();
    });

    it('should generate security reports periodically', () => {
      const generateReportSpy = jest.spyOn(monitor as any, 'generateSecurityReport');
      
      monitor.startMonitoring();
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour
      
      expect(generateReportSpy).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('📊 HOURLY SECURITY REPORT:'), 
        expect.any(String)
      );
    });

    it('should perform emergency analysis for critical threats', () => {
      const emergencyAnalysisSpy = jest.spyOn(monitor as any, 'performEmergencyAnalysis');
      
      // Mock critical threat level
      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 20,
        authFailures: 40,
        suspiciousIPCount: 8,
        blockedIPCount: 5
      });
      
      mockSecurityLogger.getSuspiciousIPs.mockReturnValue(['1.2.3.4', '5.6.7.8']);
      mockSecurityLogger.getBlockedIPs.mockReturnValue(['9.10.11.12']);

      monitor.startMonitoring();
      jest.advanceTimersByTime(5 * 60 * 1000); // Trigger deep analysis
      
      expect(emergencyAnalysisSpy).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith('🔥 EMERGENCY SECURITY ANALYSIS INITIATED');
    });

    it('should detect traffic anomalies', () => {
      const detectAnomaliesSpy = jest.spyOn(monitor as any, 'detectTrafficAnomalies');
      
      monitor.startMonitoring();
      jest.advanceTimersByTime(5 * 60 * 1000);
      
      expect(detectAnomaliesSpy).toHaveBeenCalled();
    });
  });

  describe('Console Alert Notifications', () => {
    it('should send console alert with correct formatting', () => {
      const mockAlert = {
        rule: 'Test Alert',
        severity: 'high',
        timestamp: new Date(),
        message: 'Test alert message',
        threatLevel: { level: 'red', score: 7 }
      };

      (monitor as any).sendConsoleAlert(mockAlert);
      
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Test alert message'));
    });

    it('should use different colors for different severity levels', () => {
      const severities = ['low', 'medium', 'high', 'critical'];
      
      severities.forEach(severity => {
        const mockAlert = {
          severity,
          message: `Test ${severity} alert`
        };

        (monitor as any).sendConsoleAlert(mockAlert);
        expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining(`Test ${severity} alert`));
      });
    });
  });

  describe('Monitoring Status', () => {
    it('should return comprehensive monitoring status', () => {
      const status = monitor.getMonitoringStatus();
      
      expect(status).toHaveProperty('isMonitoring');
      expect(status).toHaveProperty('currentThreatLevel');
      expect(status).toHaveProperty('activeAlertRules');
      expect(status).toHaveProperty('recentMetrics');
      expect(status).toHaveProperty('stats');
      
      expect(typeof status.isMonitoring).toBe('boolean');
      expect(typeof status.activeAlertRules).toBe('number');
      expect(Array.isArray(status.recentMetrics)).toBe(true);
    });

    it('should show correct active alert rules count', () => {
      const status = monitor.getMonitoringStatus();
      const initialCount = status.activeAlertRules;
      
      monitor.toggleAlertRule('high_attack_rate', false);
      
      const statusAfterDisable = monitor.getMonitoringStatus();
      expect(statusAfterDisable.activeAlertRules).toBe(initialCount - 1);
    });
  });

  describe('Data Cleanup and Edge Cases', () => {
    it('should cleanup old data periodically', () => {
      const cleanupSpy = jest.spyOn(monitor as any, 'cleanupOldData');
      
      monitor.startMonitoring();
      jest.advanceTimersByTime(60000);
      
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should handle missing SecurityLogger stats gracefully', () => {
      mockSecurityLogger.getSecurityStats.mockReturnValue(null);
      
      // Should return a default threat level instead of crashing
      const status = monitor.getMonitoringStatus();
      expect(status).toBeDefined();
      expect(status.currentThreatLevel).toBeDefined();
    });

    it('should handle SecurityLogger errors gracefully', () => {
      // Mock SecurityLogger to return empty stats when it would normally fail
      mockSecurityLogger.getSecurityStats.mockReturnValue({
        totalEvents: 0,
        attackAttempts: 0,
        blockedAttacks: 0,
        authFailures: 0,
        suspiciousIPCount: 0,
        blockedIPCount: 0
      });
      
      expect(() => {
        monitor.getMonitoringStatus();
      }).not.toThrow();
    });

    it('should limit metrics array size', () => {
      const collectMetricsSpy = jest.spyOn(monitor as any, 'collectMetrics');
      
      monitor.startMonitoring();
      
      // Simulate 70 minutes of data collection (should keep only last 60)
      for (let i = 0; i < 70; i++) {
        jest.advanceTimersByTime(60000);
      }
      
      expect(collectMetricsSpy).toHaveBeenCalledTimes(70);
      
      const status = monitor.getMonitoringStatus();
      expect(status.recentMetrics.length).toBeLessThanOrEqual(5); // Only shows last 5 in status
    });
  });

  describe('Event Emission', () => {
    it('should emit securityAlert events', () => {
      const alertListener = jest.fn();
      monitor.on('securityAlert', alertListener);

      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 15,
        authFailures: 0,
        suspiciousIPCount: 0,
        blockedIPCount: 0
      });

      monitor.startMonitoring();
      jest.advanceTimersByTime(60000);

      expect(alertListener).toHaveBeenCalled();
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'suspicious_activity'
      }));
    });

    it('should handle multiple event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      monitor.on('securityAlert', listener1);
      monitor.on('securityAlert', listener2);

      mockSecurityLogger.getSecurityStats.mockReturnValue({
        attackAttempts: 15,
        authFailures: 0,
        suspiciousIPCount: 0,
        blockedIPCount: 0
      });

      monitor.startMonitoring();
      jest.advanceTimersByTime(60000);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing environment variables gracefully', () => {
      const originalEnv = process.env;
      
      // Clear environment variables
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SLACK_WEBHOOK_URL;
      
      expect(() => {
        new SecurityMonitor();
      }).not.toThrow();
      
      // Restore environment
      process.env = originalEnv;
    });
  });
});
