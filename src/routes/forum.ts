import { Elysia } from 'elysia';
import { getForumPosts, getForumPostById, createForumPost } from '../controllers/forumController.js';
import { authMiddleware } from '../middleware/auth.js';

export const forumRoutes = new Elysia()
    .use(authMiddleware)
    .get('/forum', getForumPosts)
    .get('/forum/:id', getForumPostById)
    .post('/forum', (context: { user?: { id: string }, body: any }) => {
        const { user, body } = context;
        if (!user) return { error: 'No autorizado' };
        return createForumPost({ body: { ...body, userId: user.id } });
    });
