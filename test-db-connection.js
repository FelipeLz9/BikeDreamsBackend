const { PrismaClient } = require('@prisma/client');

async function testConnection() {
    const prisma = new PrismaClient();
    
    try {
        console.log('🔍 Probando conexión a la base de datos...');
        
        // Probar conexión básica
        await prisma.$connect();
        console.log('✅ Conexión exitosa');
        
        // Probar consulta simple
        const userCount = await prisma.user.count();
        console.log(`📊 Usuarios en la base de datos: ${userCount}`);
        
        // Probar consulta específica
        const testUser = await prisma.user.findUnique({
            where: { email: 'test@example.com' }
        });
        
        if (testUser) {
            console.log('✅ Usuario de prueba encontrado:', {
                id: testUser.id,
                name: testUser.name,
                email: testUser.email,
                role: testUser.role
            });
        } else {
            console.log('❌ Usuario de prueba no encontrado');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Detalles:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
