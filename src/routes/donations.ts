import { Elysia } from 'elysia';
import { createDonation, getDonations } from '../controllers/donationController.js';
import { authMiddleware } from '../middleware/auth.js';

export const donationRoutes = new Elysia()
    .use(authMiddleware)
    .get('/donations', getDonations) // Cualquier usuario puede ver donaciones
    .post('/donations', (req: { user?: { id: string }, body: any }) => {
        const { user, body } = req;
        // Si el usuario está autenticado, usa su ID, si no, deja que done como anónimo
        return createDonation({ body: { ...body, userId: user?.id } });
    });
