import { prisma } from '../prisma/client.js';

export const getNews = async () => {
    return await prisma.news.findMany();
};

export const getNewsById = async ({ params }: { params: { id: string } }) => {
    return await prisma.news.findUnique({ where: { id: params.id } });
};

export const createNews = async ({ body }: { body: { title: string, content: string } }) => {
    return await prisma.news.create({ data: body });
};
