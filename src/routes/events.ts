import { Elysia } from 'elysia';
import { getEvents } from '../controllers/eventController.js';

export const eventRoutes = new Elysia().get('/events', getEvents);
