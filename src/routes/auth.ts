import { Elysia } from 'elysia';
import { login, register } from '../controllers/authController.js';

export const authRoutes = new Elysia()
    .post('/login', login)
    .post('/register', register);
