import { prisma } from '../prisma/client';
import { z } from 'zod';

// Validación con Zod
const donationSchema = z.object({
    amount: z.number().positive(),
    userId: z.string().uuid().optional(), // Opcional si es un usuario registrado
    donorName: z.string().optional() // Opcional para donantes anónimos
});

// Crear donación (usuario autenticado o anónimo)
export const createDonation = async ({ body }: { body: any }) => {
    const validation = donationSchema.safeParse(body);
    if (!validation.success) return { error: validation.error.format() };

    return await prisma.donation.create({ data: body });
};

// Obtener todas las donaciones
export const getDonations = async () => {
    return await prisma.donation.findMany();
};
