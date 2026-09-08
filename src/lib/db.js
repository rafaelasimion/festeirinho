import mysql from 'mysql2/promise';

// Pool único da aplicação. O Next.js recarrega os módulos em modo de
// desenvolvimento, então guardamos o pool no objeto global para não
// abrir uma conexão nova a cada alteração de arquivo.
const globalParaPool = globalThis;

export const pool =
  globalParaPool._poolFesteirinho ??
  (globalParaPool._poolFesteirinho = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: 'Z',
  }));
