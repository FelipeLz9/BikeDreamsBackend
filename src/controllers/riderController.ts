import { prisma } from '../prisma/client.js';

export const getRiders = async () => {
    return await prisma.user.findMany({
        where: { role: 'CLIENT' },
        select: { id: true, name: true, racesWon: true, avatar: true }
    });
};

export const getRiderById = async ({ params }: { params: { id: string } }) => {
    return await prisma.user.findUnique({
        where: { id: params.id },
        select: { id: true, name: true, racesWon: true, avatar: true, photos: true }
    });
};
