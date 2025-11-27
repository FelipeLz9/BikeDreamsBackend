const { Pool } = require('pg');

async function testDirectLogin() {
    const pool = new Pool({
        user: 'bikedreams_user',
        host: 'localhost',
        database: 'bikedreams_dev',
        password: 'dev_password',
        port: 5432,
    });

    try {
        console.log('Testing direct PostgreSQL connection...');
        
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        
        // Test user query
        const result = await client.query('SELECT id, name, email, role, "isActive" FROM "User" WHERE email = $1', ['admin@bikedreams.com']);
        
        console.log('User found:', result.rows.length > 0 ? 'Yes' : 'No');
        if (result.rows.length > 0) {
            console.log('User details:', result.rows[0]);
        }
        
        client.release();
        
    } catch (error) {
        console.error('❌ Database connection error:', error);
    } finally {
        await pool.end();
    }
}

testDirectLogin();
