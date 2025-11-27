import { Elysia } from 'elysia';
import { cors } from "@elysiajs/cors";
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { eventRoutes } from './routes/events';
import { forumRoutes } from './routes/forum';
import { newsRoutes } from './routes/news';
import { riderRoutes } from './routes/riders';
import { donationRoutes } from './routes/donations';
import { adminRoutes } from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { swagger } from '@elysiajs/swagger';
import { searchRoutes } from "./routes/search";
import { syncRoutes } from "./routes/sync";
import { syncDebugRoutes } from "./routes/sync-debug";
import { syncManagementRoutes } from "./routes/sync-management";
import { autoSyncRoutes } from "./routes/auto-sync";
import { optimizedEventRoutes } from "./routes/optimized-events";
import { testRoutes } from "./routes/test";
import { rbacRoutes } from "./routes/rbac";

// Environment configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Configure CORS for development
const corsOptions = {
    origin: true, // Permitir todos los orígenes en desarrollo
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

const app = new Elysia()
    // Swagger para desarrollo
    .use(swagger())
    // CORS básico
    .use(cors(corsOptions))
    // Error handler
    .use(errorHandler)
    // Rutas de la API
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
        message: '🚀 BikeDreams API funcionando! (Debug Mode)',
        environment: NODE_ENV,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        cors: 'enabled',
        security: 'relaxed'
    }))
    .get('/health', () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        cors: 'enabled'
    }));

// Inicializar servidor
app.listen({ hostname: HOST, port: Number(PORT) });

console.log('🚀 Servidor corriendo en modo debug:');
console.log(`   http://localhost:${PORT}`);
console.log(`   Swagger: http://localhost:${PORT}/swagger`);
console.log('🔓 Modo debug activo (seguridad relajada)');
console.log('   - CORS habilitado para todos los orígenes');
console.log('   - Rate limiting deshabilitado');
console.log('   - Security headers relajados');
