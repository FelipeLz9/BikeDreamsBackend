import { prisma } from '../prisma/client.js';

export const getUsers = async () => {
    return await prisma.user.findMany();
};

export const getUserById = async ({ params }: { params: { id: string } }) => {
    return await prisma.user.findUnique({ where: { id: params.id } });
};
