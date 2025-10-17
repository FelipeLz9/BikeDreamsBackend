import { prisma } from '../prisma/client';
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
export const getAdminStats = async (context: any) => {
    const { headers } = context;
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
export const getAdminUsers = async (context: any) => {
    const { headers } = context;
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
export const createAdminUser = async (context: any) => {
    const { headers, body } = context;
    const { error } = await verifyAdminAuth(headers);
    if (error) return { error };

    try {
        // Validar que el body tenga la estructura esperada
        if (!body || typeof body !== 'object') {
            return { error: 'Datos de usuario requeridos' };
        }

        const { name, email, password, role } = body as { 
            name?: string; 
            email?: string; 
            password?: string; 
            role?: 'ADMIN' | 'CLIENT' 
        };

        // Verificar si el email ya existe
        if (email) {
            const existingUser = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            if (existingUser) {
                return { error: 'Ya existe un usuario con este email' };
            }
        }

        // Validaciones básicas
        if (!name || !email || !password) {
            return { error: 'Todos los campos son requeridos' };
        }

        if (password.length < 6) {
            return { error: 'La contraseña debe tener al menos 6 caracteres' };
        }

        // Crear el usuario
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: role || 'CLIENT'
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
export const updateAdminUser = async (context: any) => {
    const { headers, params, body } = context;
    const { error } = await verifyAdminAuth(headers);
    if (error) return { error };

    try {
        // Validar parámetros y body
        if (!params?.id) {
            return { error: 'ID de usuario requerido' };
        }

        if (!body || typeof body !== 'object') {
            return { error: 'Datos de actualización requeridos' };
        }

        const { name, email, password, role } = body as { 
            name?: string; 
            email?: string; 
            password?: string; 
            role?: 'ADMIN' | 'CLIENT' 
        };

        // Verificar que el usuario existe
        const existingUser = await prisma.user.findUnique({
            where: { id: params.id }
        });

        if (!existingUser) {
            return { error: 'Usuario no encontrado' };
        }

        // Si se está cambiando el email, verificar que no exista
        if (email && email !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            if (emailExists) {
                return { error: 'Ya existe un usuario con este email' };
            }
        }

        // Preparar datos para actualizar
        const updateData: any = {};
        
        if (name) updateData.name = name;
        if (email) updateData.email = email.toLowerCase();
        if (role) updateData.role = role;
        
        // Solo actualizar contraseña si se proporciona
        if (password && password.length > 0) {
            if (password.length < 6) {
                return { error: 'La contraseña debe tener al menos 6 caracteres' };
            }
            updateData.password = await bcrypt.hash(password, 10);
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
export const deleteAdminUser = async (context: any) => {
    const { headers, params } = context;
    const { error, user: currentUser } = await verifyAdminAuth(headers);
    if (error) return { error };

    try {
        // Validar parámetros
        if (!params?.id) {
            return { error: 'ID de usuario requerido' };
        }

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
