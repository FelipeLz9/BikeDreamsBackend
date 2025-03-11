import { Elysia } from 'elysia';

const app = new Elysia()
    .get('/', () => 'Servidor de BMX funcionando 🚴‍♂️');

export default app;
