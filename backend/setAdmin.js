const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const p = new Pool({ connectionString: process.env.DATABASE_URL });
p.query(`UPDATE "User" SET module = 'ADMIN'`)
  .then(() => { console.log('ok'); p.end(); })
  .catch(console.error);
