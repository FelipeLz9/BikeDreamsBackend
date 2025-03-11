import { prisma } from '../prisma/client.js';
import { z } from 'zod';

const forumPostSchema = z.object({
    userId: z.string().uuid(),
    content: z.string().min(5, "El contenido debe tener al menos 5 caracteres")
});

export const createForumPost = async ({ body }: { body: any }) => {
    const validation = forumPostSchema.safeParse(body);
    if (!validation.success) return { error: validation.error.format() };

    return await prisma.forumPost.create({ data: body });
};


export const getForumPosts = async () => {
    return await prisma.forumPost.findMany({
        include: { user: { select: { name: true, avatar: true } } }
    });
};

export const getForumPostById = async ({ params }: { params: { id: string } }) => {
    return await prisma.forumPost.findUnique({
        where: { id: params.id },
        include: { user: { select: { name: true, avatar: true } } }
    });
};
