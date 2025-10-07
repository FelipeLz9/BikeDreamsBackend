import { Elysia } from 'elysia';
import { getUsers, getUserById, getMe, updateMe, changePassword } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';

export const userRoutes = new Elysia()
    .get('/users', getUsers)
    .get('/users/me', getMe)
    .put('/users/me', updateMe)
    .put('/users/me/password', changePassword)
    .get('/users/:id', getUserById);
