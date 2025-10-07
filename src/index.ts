import { Elysia } from 'elysia';
import { cors } from "@elysiajs/cors";
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { eventRoutes } from './routes/events.js';
import { forumRoutes } from './routes/forum.js';
import { newsRoutes } from './routes/news.js';
import { riderRoutes } from './routes/riders.js';
import { donationRoutes } from './routes/donations.js';
import { adminRoutes } from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';
import { swagger } from '@elysiajs/swagger';
import { searchRoutes } from "./routes/search.js";

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
    .use(adminRoutes)
    .use(cors())
    .use(searchRoutes)
    .get('/', () => '🚀 Servidor funcionando!');

app.listen(3001);
console.log('🚀 Servidor corriendo en http://localhost:3001');
