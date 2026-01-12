import mysql from 'mysql2/promise';

console.log('Database Config Check:', {
  host: process.env.DORIS_HOST,
  user: process.env.DORIS_USER,
  hasPassword: !!process.env.DORIS_PASSWORD
});

const pool = mysql.createPool({
  host: process.env.DORIS_HOST,
  user: process.env.DORIS_USER,
  password: process.env.DORIS_PASSWORD,
  database: 'pando',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
