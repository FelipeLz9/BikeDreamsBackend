import { prisma } from '../prisma/client.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'supersecretkey';

export const register = async ({ body }: { body: { name: string, email: string, password: string } }) => {
    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
        data: { name: body.name, email: body.email, password: hashedPassword }
    });
    return { message: 'Usuario registrado', user };
};

export const login = async ({ body }: { body: { email: string, password: string } }) => {
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.password))) {
        return { error: 'Credenciales inválidas' };
    }
    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '1d' });
    return { message: 'Login exitoso', token };
};
