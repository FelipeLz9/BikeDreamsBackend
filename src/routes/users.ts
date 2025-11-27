import { Elysia } from 'elysia';
import { getUsers, getUserById } from '../controllers/userControllerDirect.js';
import { getMe, updateMe, changePassword } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';

export const userRoutes = new Elysia()
    .get('/users', getUsers)
    .use(authMiddleware)
    .get('/users/me', getMe)
    .put('/users/me', updateMe)
    .put('/users/me/password', changePassword)
    .get('/users/:id', getUserById);
