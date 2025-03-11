import { Elysia } from 'elysia';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { eventRoutes } from './routes/events.js';
import { forumRoutes } from './routes/forum.js';
import { newsRoutes } from './routes/news.js';
import { riderRoutes } from './routes/riders.js';
import { donationRoutes } from './routes/donations.js';
import { errorHandler } from './middleware/errorHandler.js';
import { swagger } from '@elysiajs/swagger';

const app = new Elysia()
    .use(swagger())
    .use(errorHandler)
    .use(authRoutes)
    .use(userRoutes)
    .use(eventRoutes)
    .use(forumRoutes)
    .use(newsRoutes)
    .use(riderRoutes)
    .use(donationRoutes)
    .get('/', () => '🚀 Servidor funcionando!');

app.listen(3000);
console.log('🚀 Servidor corriendo en http://localhost:3000');
