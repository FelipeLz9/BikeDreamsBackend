import { Elysia } from 'elysia';
import { getNews, getNewsById, createNews } from '../controllers/newsController.js';

export const newsRoutes = new Elysia()
    .get('/news', getNews)
    .get('/news/:id', getNewsById)
    .post('/news', createNews);
