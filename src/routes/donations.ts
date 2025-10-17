import { Elysia } from 'elysia';
import { createDonation, getDonations } from '../controllers/donationController';
import { authMiddleware } from '../middleware/auth';
import { financialSecurityMiddleware } from '../middleware/strictSecurity';
import { fullValidationPlugin } from '../plugins/validationPlugin';

export const donationRoutes = new Elysia()
    .use(authMiddleware)
    .get('/donations', getDonations) // Cualquier usuario puede ver donaciones
    .use(financialSecurityMiddleware()) // Seguridad financiera para transacciones
    .use(fullValidationPlugin({ contentType: 'donation', logAttempts: true, strictMode: true }))
    .post('/donations', (req: { user?: { id: string }, body: any }) => {
        const { user, body } = req;
        // Si el usuario está autenticado, usa su ID, si no, deja que done como anónimo
        return createDonation({ body: { ...body, userId: user?.id } });
    });
