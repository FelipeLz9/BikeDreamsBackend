import { Elysia } from 'elysia';
import { 
    getAdminStats, 
    getAdminUsers, 
    createAdminUser, 
    updateAdminUser, 
    deleteAdminUser 
} from '../controllers/adminController.js';

export const adminRoutes = new Elysia({ prefix: '/admin' })
    .get('/stats', getAdminStats)
    .get('/users', getAdminUsers)
    .post('/users', createAdminUser)
    .put('/users/:id', updateAdminUser)
    .delete('/users/:id', deleteAdminUser);
