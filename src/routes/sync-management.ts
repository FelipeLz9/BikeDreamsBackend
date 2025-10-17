import { Elysia } from 'elysia';
import { 
  executeAdvancedSync,
  getSyncStatistics,
  getSyncLogs,
  getSyncConfigurations,
  upsertSyncConfiguration,
  toggleSyncConfiguration,
  getActiveConfiguration,
  getSyncDashboard
} from '../controllers/syncManagementController';
import { authMiddleware } from '../middleware/auth';

export const syncManagementRoutes = new Elysia({ prefix: '/api/sync/management' })
  .use(authMiddleware) // Requiere autenticación de admin
  
  /**
   * GET /api/sync/management/dashboard - Dashboard completo de sincronización
   */
  .get('/dashboard', async () => {
    return await getSyncDashboard();
  })
  
  /**
   * POST /api/sync/management/execute - Ejecuta sincronización con logging avanzado
   */
  .post('/execute', async (context: any) => {
    const { syncType } = context.body as { syncType?: string };
    return await executeAdvancedSync(syncType, context.user?.userId);
  })
  
  /**
   * GET /api/sync/management/statistics - Estadísticas de sincronización
   */
  .get('/statistics', async (context: any) => {
    const { days } = context.query as { days?: string };
    return await getSyncStatistics(days ? parseInt(days) : undefined);
  })
  
  /**
   * GET /api/sync/management/logs - Logs de sincronización con paginación
   */
  .get('/logs', async (context: any) => {
    const { page, limit, status } = context.query as { page?: string; limit?: string; status?: string };
    return await getSyncLogs(
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
      status
    );
  })
  
  /**
   * GET /api/sync/management/configurations - Lista configuraciones disponibles
   */
  .get('/configurations', async () => {
    return await getSyncConfigurations();
  })
  
  /**
   * GET /api/sync/management/configurations/active - Obtiene configuración activa
   */
  .get('/configurations/active', async () => {
    return await getActiveConfiguration();
  })
  
  /**
   * POST /api/sync/management/configurations - Crea o actualiza configuración
   */
  .post('/configurations', async (context: any) => {
    const configData = {
      ...(context.body as any),
      createdBy: context.user?.userId
    };
    return await upsertSyncConfiguration(configData);
  })
  
  /**
   * PUT /api/sync/management/configurations/:id/toggle - Activa/desactiva configuración
   */
  .put('/configurations/:id/toggle', async (context: any) => {
    const { id } = context.params as { id: string };
    const { isActive } = context.body as { isActive: boolean };
    return await toggleSyncConfiguration(parseInt(id), isActive);
  })
  
  /**
   * GET /api/sync/management/status - Estado general del sistema de sincronización
   */
  .get('/status', async () => {
    try {
      const activeConfig = await getActiveConfiguration();
      const recentStats = await getSyncStatistics(1); // Últimas 24 horas
      
      return {
        success: true,
        data: {
          autoSyncEnabled: activeConfig.data?.autoSyncEnabled || false,
          hasActiveConfiguration: !!activeConfig.data,
          lastSyncSuccess: recentStats.data?.successful > 0,
          totalSyncsToday: recentStats.data?.totalSyncs || 0,
          systemHealthy: true // Se puede extender con más checks
        },
        message: 'Estado del sistema obtenido exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        data: {
          autoSyncEnabled: false,
          hasActiveConfiguration: false,
          lastSyncSuccess: false,
          totalSyncsToday: 0,
          systemHealthy: false
        }
      };
    }
  });
