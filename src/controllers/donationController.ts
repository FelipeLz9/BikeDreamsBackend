import { prisma } from '../prisma/client.js';

export const getDonations = async () => {
    return await prisma.donation.findMany({
        include: { user: { select: { name: true } } }
    });
};

export const createDonation = async ({ body }: { body: { userId: string, amount: number } }) => {
    return await prisma.donation.create({ data: body });
};
