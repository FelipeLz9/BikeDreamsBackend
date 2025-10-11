import { Elysia } from 'elysia';
import { cors } from "@elysiajs/cors";
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { eventRoutes } from './routes/events.js';
import { forumRoutes } from './routes/forum.js';
import { newsRoutes } from './routes/news.js';
import { riderRoutes } from './routes/riders.js';
import { donationRoutes } from './routes/donations.js';
import { adminRoutes } from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';
import { swagger } from '@elysiajs/swagger';
import { fullSecurityHeaders } from './middleware/securityHeaders.js';
import { searchRoutes } from "./routes/search.js";
import { syncRoutes } from "./routes/sync.js";
import { syncDebugRoutes } from "./routes/sync-debug.js";
import { syncManagementRoutes } from "./routes/sync-management.js";
import { autoSyncRoutes } from "./routes/auto-sync.js";
import { optimizedEventRoutes } from "./routes/optimized-events.js";
import { testRoutes } from "./routes/test.js";
import { rbacRoutes } from "./routes/rbac.js";
import { 
    rateLimiterMiddleware, 
    suspiciousActivityDetection, 
    ipBlockingMiddleware 
} from './middleware/rateLimiter.js';
import { AuthService } from './services/authService.js';
import { securityMonitor } from './services/securityMonitor.js';
import { SecurityLogger } from './services/securityLogger.js';
import cron from 'node-cron';

// Environment configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Configure CORS for production
const corsOptions = {
    origin: NODE_ENV === 'production' ? CORS_ORIGIN : true,
    credentials: true
};

const app = new Elysia()
    // Only use Swagger in development
    .use(NODE_ENV === 'development' ? swagger() : (app: any) => app)
    // Security middlewares - Order matters!
    .use(fullSecurityHeaders()) // Aplicar headers de seguridad primero
    .use(errorHandler)
    .use(ipBlockingMiddleware)
    .use(suspiciousActivityDetection)
    .use(rateLimiterMiddleware)
    // Remover cors básico ya que fullSecurityHeaders incluye CORS avanzado
    // .use(cors(corsOptions))
    .use(authRoutes)
    .use(userRoutes)
    .use(eventRoutes)
    .use(forumRoutes)
    .use(newsRoutes)
    .use(riderRoutes)
    .use(donationRoutes)
    .use(adminRoutes)
    .use(searchRoutes)
    .use(syncRoutes)
    .use(syncDebugRoutes)
    .use(syncManagementRoutes)
    .use(autoSyncRoutes)
    .use(optimizedEventRoutes)
    .use(testRoutes)
    .use(rbacRoutes)
    .get('/', () => ({
        message: '🚀 BikeDreams API funcionando!',
        environment: NODE_ENV,
        version: '1.0.0',
        timestamp: new Date().toISOString()
    }))
    .get('/health', () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    }));

// Inicializar servidor
app.listen({ hostname: HOST, port: Number(PORT) });

// Inicializar monitoreo de seguridad
securityMonitor.startMonitoring();
console.log('🛡️  Sistema de monitoreo de seguridad iniciado');

// Tareas de limpieza programadas
if (NODE_ENV === 'production') {
    // Limpiar tokens expirados cada hora
    cron.schedule('0 * * * *', async () => {
        console.log('🧹 Ejecutando limpieza de tokens expirados...');
        try {
            await AuthService.cleanupExpiredTokens();
            console.log('✅ Limpieza de tokens completada');
        } catch (error) {
            console.error('❌ Error en limpieza de tokens:', error);
        }
    });
    
    console.log('⏰ Tareas programadas de limpieza iniciadas');
}

// Logging inicial
if (NODE_ENV === 'development') {
    console.log('🚀 Servidor corriendo en modo desarrollo:');
    console.log(`   http://localhost:${PORT}`);
    console.log(`   Swagger: http://localhost:${PORT}/swagger`);
    console.log('🔒 Middlewares de seguridad activos:');
    console.log('   - Rate Limiting');
    console.log('   - Suspicious Activity Detection');
    console.log('   - IP Blocking');
    console.log('   - Advanced JWT Authentication');
    console.log('   - Headers de Seguridad Avanzados (CSP, HSTS, CORS)');
    console.log('   - Validación y Sanitización Integral');
    console.log('   - Monitoreo de Seguridad en Tiempo Real');
} else {
    console.log('🚀 Servidor corriendo en modo producción:');
    console.log(`   Host: ${HOST}:${PORT}`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log('🔒 Sistema de seguridad activo:');
    console.log('   ✅ Autenticación JWT robusta');
    console.log('   ✅ Protección contra ataques de fuerza bruta');
    console.log('   ✅ Rate limiting por endpoint');
    console.log('   ✅ Detección de actividad sospechosa');
    console.log('   ✅ Headers de seguridad avanzados');
    console.log('   ✅ Content Security Policy (CSP)');
    console.log('   ✅ HTTP Strict Transport Security (HSTS)');
    console.log('   ✅ CORS y Permissions Policy');
    console.log('   ✅ Logging de auditoría y seguridad');
    console.log('   ✅ Limpieza automática de tokens');
    console.log('   ✅ Validación y sanitización integral');
    console.log('   ✅ Monitoreo de seguridad en tiempo real');
    console.log('   ✅ Sistema RBAC granular');
    console.log('   ✅ Alertas automáticas de seguridad');
}
