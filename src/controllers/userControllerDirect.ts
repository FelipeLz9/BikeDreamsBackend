import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bikedreams_dev',
  password: 'dev_password',
  port: 5432,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export const getUsers = async () => {
    try {
        console.log('🔍 Attempting to connect to database...');
        const client = await pool.connect();
        console.log('✅ Database connection successful');
        
        const result = await client.query('SELECT * FROM "User"');
        console.log(`📊 Found ${result.rows.length} users`);
        
        client.release();
        
        return {
            users: result.rows.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                racesWon: user.racesWon,
                isActive: user.isActive,
                createdAt: user.createdAt
            }))
        };
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        return { error: `Error fetching users: ${error.message}` };
    }
};

export const getUserById = async (context: any) => {
    try {
        const { params } = context;
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM "User" WHERE id = $1', [params.id]);
        client.release();
        
        if (result.rows.length === 0) {
            return { error: 'User not found' };
        }
        
        const user = result.rows[0];
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            racesWon: user.racesWon,
            isActive: user.isActive,
            createdAt: user.createdAt
        };
    } catch (error) {
        console.error('Error fetching user:', error);
        return { error: 'Error fetching user' };
    }
};
