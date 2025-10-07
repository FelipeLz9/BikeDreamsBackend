import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';

export const authMiddleware = new Elysia()
    .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'supersecretkey'
    }))
    .derive(async ({ jwt, headers }) => {
        const authHeader = headers.authorization;
        if (!authHeader) {
            return { user: null };
        }

        const token = authHeader.split(' ')[1];
        
        try {
            const user = await jwt.verify(token);
            return { user };
        } catch (error) {
            return { user: null };
        }
    });
