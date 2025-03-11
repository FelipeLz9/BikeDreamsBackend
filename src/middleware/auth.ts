import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';

export const authMiddleware = new Elysia()
    .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'supersecret'
    }))
    .derive(async ({ jwt, headers }) => {
        const authHeader = headers.authorization;
        if (!authHeader) return { user: null };

        const token = authHeader.split(' ')[1];
        const user = await jwt.verify(token);
        return { user };
    });
