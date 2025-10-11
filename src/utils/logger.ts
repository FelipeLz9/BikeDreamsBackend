// Simple logger utility for BikeDreams Backend
interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel = process.env.LOG_LEVEL || 'info';

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: string, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const formattedLevel = level.toUpperCase().padEnd(5);
    
    let logMessage = `[${timestamp}] ${formattedLevel} ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      if (this.isDevelopment) {
        // En desarrollo, mostrar contexto formateado
        logMessage += `\n${JSON.stringify(context, null, 2)}`;
      } else {
        // En producción, mostrar contexto en una línea
        logMessage += ` ${JSON.stringify(context)}`;
      }
    }

    // Usar console apropiado según el nivel
    switch (level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.formatMessage('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.formatMessage('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.formatMessage('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.formatMessage('error', message, context);
  }

  // Método especial para errores con stack trace
  exception(error: Error, message?: string, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };

    this.formatMessage('error', message || 'Unhandled exception', errorContext);
  }
}

// Exportar instancia singleton
const logger = new Logger();
export default logger;
