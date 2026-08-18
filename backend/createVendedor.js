const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function createVendedor() {
  try {
    const email = 'vendedor@magalhaes.com';
    const hash = await bcrypt.hash('123456', 10);
    const id = require('crypto').randomUUID();
    
    // Check if exists
    const res = await p.query('SELECT id FROM "User" WHERE email = $1', [email]);
    if (res.rows.length > 0) {
      console.log('User already exists');
    } else {
      await p.query(`
        INSERT INTO "User" (id, name, email, password, role, module, "updatedAt")
        VALUES ($1, 'Vendedor Almoxarifado', $2, $3, 'USER', 'WAREHOUSE', NOW())
      `, [id, email, hash]);
      console.log('Vendedor created!');
    }
  } catch (e) {
    console.error(e);
  } finally {
    p.end();
  }
}

createVendedor();
