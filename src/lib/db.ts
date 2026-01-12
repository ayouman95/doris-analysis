import mysql from 'mysql2/promise';

const poolConfig = {
  host: process.env.DORIS_HOST,
  port: Number(process.env.DORIS_PORT) || 9030, // Doris default MySQL port is 9030
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

globalForDb.db = pool;
console.log('Database Config Check:', {
  host: process.env.DORIS_HOST,
  user: process.env.DORIS_USER,
  hasPassword: !!process.env.DORIS_PASSWORD,
  poolStatus: 'Initialized'
});

export default pool;
