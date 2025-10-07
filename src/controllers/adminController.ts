import { prisma } from '../prisma/client.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Middleware para verificar que el usuario sea administrador
const verifyAdminAuth = async (headers: any) => {
    const authHeader = headers.authorization;
    
    if (!authHeader) {
        return { error: 'No autorizado', user: null };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return { error: 'No autorizado', user: null };
    }

    try {
        const decoded = jwt.verify(token, SECRET) as { id: string, email: string };
        
        const user = await prisma.user.findUnique({ 
            where: { id: decoded.id },
            select: { id: true, email: true, role: true }
        });
        
        if (!user || user.role !== 'ADMIN') {
            return { error: 'Acceso denegado. Solo administradores.', user: null };
        }
        
        return { user, error: null };
    } catch (error) {
        return { error: 'Token inválido', user: null };
    }
};

// GET /admin/stats - Estadísticas del sistema
export const getAdminStats = async ({ headers }: { headers: any }) => {
    const { error } = await verifyAdminAuth(headers);
    if (error) return { error };

    try {
        const totalUsers = await prisma.user.count();
        const adminUsers = await prisma.user.count({ where: { role: 'ADMIN' } });
        const clientUsers = await prisma.user.count({ where: { role: 'CLIENT' } });
        
        // Para esta implementación, consideraremos todos los usuarios como activos
        // En el futuro podrías agregar un campo "status" o "lastLogin"
        const activeUsers = totalUsers;

        return {
            totalUsers,
            activeUsers,
            adminUsers,
            clientUsers
        };
    } catch (error) {
        console.error('Error getting admin stats:', error);
        return { error: 'Error al obtener estadísticas' };
    }
};

// GET /admin/users - Lista de usuarios
export const getAdminUsers = async ({ headers }: { headers: any }) => {
    const { error } = await verifyAdminAuth(headers);
    if (error) return { error };

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                createdAt: true,
                racesWon: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return users;
    } catch (error) {
        console.error('Error getting users:', error);
        return { error: 'Error al obtener usuarios' };
    }
};

// POST /admin/users - Crear usuario
export const createAdminUser = async ({ 
    headers, 
    body 
}: { 
    headers: any, 
    body: { name: string, email: string, password: string, role: 'ADMIN' | 'CLIENT' } 
}) => {
    const { error } = await verifyAdminAuth(headers);
    if (error) return { error };

    try {
        // Verificar si el email ya existe
        const existingUser = await prisma.user.findUnique({
            where: { email: body.email }
        });

        if (existingUser) {
            return { error: 'Ya existe un usuario con este email' };
        }

        // Validaciones básicas
        if (!body.name || !body.email || !body.password) {
            return { error: 'Todos los campos son requeridos' };
        }

        if (body.password.length < 6) {
            return { error: 'La contraseña debe tener al menos 6 caracteres' };
        }

        // Crear el usuario
        const hashedPassword = await bcrypt.hash(body.password, 10);
        const newUser = await prisma.user.create({
            data: {
                name: body.name,
                email: body.email.toLowerCase(),
                password: hashedPassword,
                role: body.role || 'CLIENT'
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                createdAt: true,
                racesWon: true
            }
        });

        return { message: 'Usuario creado exitosamente', user: newUser };
    } catch (error) {
        console.error('Error creating user:', error);
        return { error: 'Error al crear usuario' };
    }
};

// PUT /admin/users/:id - Actualizar usuario
export const updateAdminUser = async ({ 
    headers, 
    params, 
    body 
}: { 
    headers: any, 
    params: { id: string },
    body: { name?: string, email?: string, password?: string, role?: 'ADMIN' | 'CLIENT' } 
}) => {
    const { error } = await verifyAdminAuth(headers);
    if (error) return { error };

    try {
        // Verificar que el usuario existe
        const existingUser = await prisma.user.findUnique({
            where: { id: params.id }
        });

        if (!existingUser) {
            return { error: 'Usuario no encontrado' };
        }

        // Si se está cambiando el email, verificar que no exista
        if (body.email && body.email !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: body.email.toLowerCase() }
            });

            if (emailExists) {
                return { error: 'Ya existe un usuario con este email' };
            }
        }

        // Preparar datos para actualizar
        const updateData: any = {};
        
        if (body.name) updateData.name = body.name;
        if (body.email) updateData.email = body.email.toLowerCase();
        if (body.role) updateData.role = body.role;
        
        // Solo actualizar contraseña si se proporciona
        if (body.password && body.password.length > 0) {
            if (body.password.length < 6) {
                return { error: 'La contraseña debe tener al menos 6 caracteres' };
            }
            updateData.password = await bcrypt.hash(body.password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: params.id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                createdAt: true,
                racesWon: true
            }
        });

        return { message: 'Usuario actualizado exitosamente', user: updatedUser };
    } catch (error) {
        console.error('Error updating user:', error);
        return { error: 'Error al actualizar usuario' };
    }
};

// DELETE /admin/users/:id - Eliminar usuario
export const deleteAdminUser = async ({ 
    headers, 
    params 
}: { 
    headers: any, 
    params: { id: string } 
}) => {
    const { error, user: currentUser } = await verifyAdminAuth(headers);
    if (error) return { error };

    try {
        // Verificar que el usuario existe
        const userToDelete = await prisma.user.findUnique({
            where: { id: params.id }
        });

        if (!userToDelete) {
            return { error: 'Usuario no encontrado' };
        }

        // No permitir que un admin se elimine a sí mismo
        if (currentUser?.id === params.id) {
            return { error: 'No puedes eliminar tu propia cuenta' };
        }

        // Eliminar el usuario (esto también eliminará registros relacionados por CASCADE)
        await prisma.user.delete({
            where: { id: params.id }
        });

        return { message: 'Usuario eliminado exitosamente' };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { error: 'Error al eliminar usuario' };
    }
};
