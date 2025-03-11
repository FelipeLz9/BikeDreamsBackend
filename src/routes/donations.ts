import { Elysia } from 'elysia';
import { getDonations, createDonation } from '../controllers/donationController.js';

export const donationRoutes = new Elysia()
    .get('/donations', getDonations)
    .post('/donations', createDonation);
