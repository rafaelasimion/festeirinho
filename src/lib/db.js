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
    // Os DATETIME do sistema são relógio de parede, não instantes com fuso
    // (lib/datas.js explica por quê). Com dateStrings o mysql2 entrega o
    // texto como está no banco — '2026-09-28 20:53:00' — em vez de montar
    // um Date interpretando esse texto num fuso qualquer.
    //
    // O timezone: 'Z' que havia aqui fazia exatamente essa interpretação, e
    // era a origem das três horas a menos em toda data exibida: o valor
    // gravado em horário local voltava como se fosse UTC, e o navegador o
    // convertia de novo para o horário local.
    dateStrings: true,
  }));
