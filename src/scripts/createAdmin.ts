import { prisma } from '../prisma/client';
import bcrypt from 'bcrypt';

async function createAdminUser() {
    try {
        // Verificar si ya existe un administrador
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'ADMIN' }
        });

        if (existingAdmin) {
            console.log('✅ Ya existe un usuario administrador:');
            console.log(`   Email: ${existingAdmin.email}`);
            console.log(`   Nombre: ${existingAdmin.name}`);
            return;
        }

        // Datos del administrador
        const adminData = {
            name: 'Administrador BMX',
            email: 'admin@bmxclub.com',
            password: 'admin123456', // Contraseña temporal - cámbiala después
            role: 'ADMIN' as const
        };

        // Verificar si ya existe un usuario con este email
        const existingUser = await prisma.user.findUnique({
            where: { email: adminData.email }
        });

        if (existingUser) {
            // Si existe pero no es admin, actualizar a admin
            if (existingUser.role !== 'ADMIN') {
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { role: 'ADMIN' }
                });
                console.log('✅ Usuario existente actualizado a Administrador:');
                console.log(`   Email: ${existingUser.email}`);
                console.log(`   Nombre: ${existingUser.name}`);
            } else {
                console.log('✅ El usuario ya es administrador');
            }
            return;
        }

        // Crear hash de la contraseña
        const hashedPassword = await bcrypt.hash(adminData.password, 10);

        // Crear el usuario administrador
        const adminUser = await prisma.user.create({
            data: {
                name: adminData.name,
                email: adminData.email,
                password: hashedPassword,
                role: adminData.role
            }
        });

        console.log('🎉 ¡Usuario administrador creado exitosamente!');
        console.log('');
        console.log('📋 Credenciales de acceso:');
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Contraseña: ${adminData.password}`);
        console.log('');
        console.log('🔐 IMPORTANTE: Cambia la contraseña después del primer login');
        console.log('');
        console.log('🚀 Pasos para acceder:');
        console.log('   1. Ve a http://localhost:3000/login');
        console.log('   2. Inicia sesión con las credenciales de arriba');
        console.log('   3. Haz clic en tu nombre → "Administración"');
        console.log('   4. ¡Ya puedes gestionar usuarios!');

    } catch (error) {
        console.error('❌ Error al crear usuario administrador:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar el script
createAdminUser();
