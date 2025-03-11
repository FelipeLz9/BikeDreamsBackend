import { Elysia } from 'elysia';

export const errorHandler = new Elysia()
    .onError(({ code, error }) => {
        console.error(`❌ Error (${code}):`, error);
        return { error: 'Ocurrió un error en el servidor' };
    });
