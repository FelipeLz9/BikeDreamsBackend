// Simular exactamente lo que hace el backend
const { PrismaClient } = require('@prisma/client');

async function testBackendLogin() {
    console.log('Testing backend login simulation...');
    
    try {
        // Usar la misma configuración que el backend
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL
                }
            }
        });
        
        console.log('DATABASE_URL:', process.env.DATABASE_URL);
        
        // Test basic connection
        await prisma.$connect();
        console.log('✅ Database connected successfully');
        
        // Test user query (simulando AuthService.login)
        const user = await prisma.user.findUnique({
            where: { email: 'admin@bikedreams.com' }
        });
        
        console.log('User found:', user ? 'Yes' : 'No');
        if (user) {
            console.log('User details:', {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            });
            
            // Test password verification
            const bcrypt = require('bcrypt');
            const password = 'admin123456';
            const isValid = await bcrypt.compare(password, user.password);
            console.log('Password is valid:', isValid);
        }
        
    } catch (error) {
        console.error('❌ Backend simulation error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Configurar variables de entorno manualmente
process.env.DATABASE_URL = 'postgresql://bikedreams_user:dev_password@localhost:5432/bikedreams_dev';

testBackendLogin();
