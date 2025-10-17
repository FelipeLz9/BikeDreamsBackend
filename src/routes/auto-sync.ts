import { Elysia } from 'elysia';
import { 
  initializeAutoSync,
  enableAutoSync,
  getAutoSyncStatus,
  reloadAutoSyncConfigurations,
  stopAllAutoSync,
  scheduleSync,
  cancelScheduledSync,
  testScheduledSync
} from '../controllers/autoSyncController';
import { authMiddleware } from '../middleware/auth';

export const autoSyncRoutes = new Elysia({ prefix: '/api/sync/auto' })
  .use(authMiddleware) // Requiere autenticación de admin
  
  /**
   * POST /api/sync/auto/initialize - Inicializa el sistema de sincronización automática
   */
  .post('/initialize', async () => {
    return await initializeAutoSync();
  })
  
  /**
   * GET /api/sync/auto/status - Obtiene el estado del sistema de sincronización automática
   */
  .get('/status', async () => {
    return await getAutoSyncStatus();
  })
  
  /**
   * POST /api/sync/auto/enable - Habilita la sincronización automática para una configuración
   */
  .post('/enable', async ({ body }) => {
    const data = body as {
      configurationId: number;
      cronExpression?: string;
      autoSyncEnabled?: boolean;
    };
    return await enableAutoSync(data);
  })
  
  /**
   * POST /api/sync/auto/schedule - Programa una nueva tarea de sincronización
   */
  .post('/schedule', async ({ body }) => {
    const data = body as {
      configurationId: number;
      cronExpression: string;
    };
    return await scheduleSync(data);
  })
  
  /**
   * DELETE /api/sync/auto/schedule/:id - Cancela una tarea de sincronización programada
   */
  .delete('/schedule/:id', async ({ params }) => {
    const { id } = params as { id: string };
    return await cancelScheduledSync(parseInt(id));
  })
  
  /**
   * POST /api/sync/auto/test/:id - Ejecuta una prueba de sincronización
   */
  .post('/test/:id', async ({ params }) => {
    const { id } = params as { id: string };
    return await testScheduledSync(parseInt(id));
  })
  
  /**
   * POST /api/sync/auto/reload - Recarga las configuraciones de sincronización
   */
  .post('/reload', async () => {
    return await reloadAutoSyncConfigurations();
  })
  
  /**
   * POST /api/sync/auto/stop-all - Detiene todas las tareas de sincronización automática
   */
  .post('/stop-all', async () => {
    return await stopAllAutoSync();
  })
  
  /**
   * GET /api/sync/auto/cron-examples - Devuelve ejemplos de expresiones cron comunes
   */
  .get('/cron-examples', async () => {
    return {
      success: true,
      data: {
        examples: [
          {
            expression: '0 2 * * *',
            description: 'Diario a las 2:00 AM',
            frequency: 'daily'
          },
          {
            expression: '0 3 * * *',
            description: 'Diario a las 3:00 AM',
            frequency: 'daily'
          },
          {
            expression: '0 2 * * 0',
            description: 'Semanal los domingos a las 2:00 AM',
            frequency: 'weekly'
          },
          {
            expression: '0 */6 * * *',
            description: 'Cada 6 horas',
            frequency: 'every-6-hours'
          },
          {
            expression: '0 */12 * * *',
            description: 'Cada 12 horas',
            frequency: 'every-12-hours'
          },
          {
            expression: '0 2 1 * *',
            description: 'Mensual el día 1 a las 2:00 AM',
            frequency: 'monthly'
          }
        ],
        format: {
          fields: ['minute', 'hour', 'day', 'month', 'weekday'],
          example: '0 2 * * * = minute=0, hour=2, any day, any month, any weekday'
        }
      },
      message: 'Ejemplos de expresiones cron obtenidos'
    };
  });
