import { Elysia } from 'elysia';
import { getRiders, getRiderById } from '../controllers/riderController.js';

export const riderRoutes = new Elysia()
    .get('/riders', getRiders)
    .get('/riders/:id', getRiderById);