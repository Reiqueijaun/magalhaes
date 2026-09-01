const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

// VULN-07: Senha nao pode ser hardcoded. Passe via argumento CLI:
//   node createVendedor.js <email> <senha>
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Uso: node createVendedor.js <email> <senha>');
  console.error('Exemplo: node createVendedor.js vendedor@empresa.com MinhaSenh@123');
  process.exit(1);
}

if (password.length < 8) {
  console.error('A senha deve ter pelo menos 8 caracteres.');
  process.exit(1);
}

const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function createUser() {
  try {
    const hash = await bcrypt.hash(password, 12); // bcrypt custo 12 (igual ao servidor)
    const id = require('crypto').randomUUID();

    const res = await p.query('SELECT id FROM "User" WHERE email = $1', [email]);
    if (res.rows.length > 0) {
      console.log('Usuário já existe:', email);
    } else {
      await p.query(
        `INSERT INTO "User" (id, name, email, password, role, module, "updatedAt")
         VALUES ($1, $2, $3, $4, 'USER', 'WAREHOUSE', NOW())`,
        [id, 'Vendedor Almoxarifado', email, hash]
      );
      console.log('Usuário criado com sucesso:', email);
    }
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  } finally {
    p.end();
  }
}

createUser();
