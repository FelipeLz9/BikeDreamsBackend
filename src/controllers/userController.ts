import { prisma } from '../prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const SECRET = process.env.JWT_SECRET || 'supersecretkey';

export const getUsers = async () => {
    return await prisma.user.findMany();
};

export const getUserById = async (context: any) => {
    const { params } = context;
    return await prisma.user.findUnique({ where: { id: params.id } });
};

export const getMe = async (context: any) => {
    const { headers } = context;
    const authHeader = headers.authorization;
    
    if (!authHeader) {
        return { error: 'No autorizado' };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return { error: 'No autorizado' };
    }

    try {
        const decoded = jwt.verify(token, SECRET) as { id: string, email: string };
        
        const userData = await prisma.user.findUnique({ 
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                racesWon: true,
                createdAt: true
            }
        });
        
        if (!userData) {
            return { error: 'Usuario no encontrado' };
        }
        
        return userData;
    } catch (error) {
        return { error: 'Token inválido' };
    }
};

export const updateMe = async (context: any) => {
    const { headers, body } = context;
    
    // Validar que el body tenga la estructura esperada
    if (!body || typeof body !== 'object') {
        return { error: 'Datos de actualización requeridos' };
    }

    const authHeader = headers.authorization;
    
    if (!authHeader) {
        return { error: 'No autorizado' };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return { error: 'No autorizado' };
    }

    try {
        const decoded = jwt.verify(token, SECRET) as { id: string, email: string };
        
        const updatedUser = await prisma.user.update({
            where: { id: decoded.id },
            data: {
                ...(body.name && { name: body.name }),
                ...(body.avatar && { avatar: body.avatar })
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                racesWon: true,
                createdAt: true
            }
        });
        
        return { message: 'Perfil actualizado', user: updatedUser };
    } catch (error) {
        return { error: 'Error al actualizar perfil' };
    }
};

export const changePassword = async (context: any) => {
    const { headers, body } = context;
    
    // Validar que el body tenga la estructura esperada
    if (!body || typeof body !== 'object') {
        return { error: 'Datos de cambio de contraseña requeridos' };
    }

    const authHeader = headers.authorization;
    
    if (!authHeader) {
        return { error: 'No autorizado' };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return { error: 'No autorizado' };
    }

    try {
        const decoded = jwt.verify(token, SECRET) as { id: string, email: string };
        
        // Verificar contraseña actual
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            return { error: 'Usuario no encontrado' };
        }

        const isValidPassword = await bcrypt.compare(body.currentPassword, user.password);
        if (!isValidPassword) {
            return { error: 'Contraseña actual incorrecta' };
        }

        // Actualizar contraseña
        const hashedPassword = await bcrypt.hash(body.newPassword, 10);
        await prisma.user.update({
            where: { id: decoded.id },
            data: { password: hashedPassword }
        });
        
        return { message: 'Contraseña actualizada exitosamente' };
    } catch (error) {
        return { error: 'Error al cambiar contraseña' };
    }
};
