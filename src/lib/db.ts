import mysql from 'mysql2/promise';

const poolConfig = {
  host: process.env.DORIS_HOST,
  user: process.env.DORIS_USER,
  password: process.env.DORIS_PASSWORD,
  database: 'pando',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Use a global variable to store the pool instance in development
// to avoid creating multiple pools during hot reloads.
const globalForDb = global as unknown as { db: mysql.Pool };

const pool = globalForDb.db || mysql.createPool(poolConfig);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = pool;
  console.log('Database Config Check:', {
    host: process.env.DORIS_HOST,
    user: process.env.DORIS_USER,
    hasPassword: !!process.env.DORIS_PASSWORD,
    poolStatus: 'Initialized'
  });
}

export default pool;
