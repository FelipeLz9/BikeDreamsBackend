import { Elysia } from 'elysia';
import { getUsers, getUserById } from '../controllers/userController.js';

export const userRoutes = new Elysia()
    .get('/users', getUsers)
    .get('/users/:id', getUserById);
