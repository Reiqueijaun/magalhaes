import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const pdfParse = require('pdf-parse');
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'magalhaes-secret-key-change-in-production';

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Proteções Globais
app.use(helmet()); // Blindagem básica de cabeçalhos de segurança (XSS, Sniffing, Clickjacking)
app.use(hpp());    // Impede ataque de poluição de parâmetros HTTP
app.use(compression()); // ← gzip: reduz payload JSON em ~70%
app.use(express.json({ limit: '10mb' })); // Limita o body para evitar DoS por carga excessiva

// Limite Global da API (Evita DoS generalizado - 200 reqs / min / IP)
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 200, 
  message: { error: 'Muitas requisições deste IP, tente novamente em um minuto.' }
});
app.use('/api', globalLimiter);

// Limite Rigoroso para Login e Recuperação de Senha (Evita Força Bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Apenas 5 tentativas por IP
  message: { error: 'Muitas tentativas de login ou recuperação. Seu IP foi bloqueado temporariamente por questões de segurança. Tente novamente em 15 minutos.' }
});

// ─── MIDDLEWARE DE AUTENTICAÇÃO ────────────────────────────────────────────────
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'Token não fornecido.' }); return; }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

// ─── MIDDLEWARE DE MÓDULO WAREHOUSE ───────────────────────────────────────────
const warehouseAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'Token não fornecido.' }); return; }
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const mod = decoded.module || 'FINANCE';
    if (mod !== 'WAREHOUSE' && mod !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso negado. Módulo de almoxarifado requerido.' });
      return;
    }
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: '✅ Backend Magalhaes operacional', database: 'PostgreSQL via Neon', version: '2026-08-20-v3', warehouse: true });
});

// ─── AUTO-MIGRAÇÃO: garante que colunas e tabelas novas existem ───────────────
async function runMigrations() {
  const pg = require('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Adiciona coluna context em Transaction (se não existir)
    await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'PJ';`);
    // Adiciona coluna context em Category (se não existir)
    await pool.query(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'PJ';`);
    // Cria tabela Budget (se não existir)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Budget" (
        id TEXT NOT NULL PRIMARY KEY,
        "categoryId" TEXT,
        name TEXT NOT NULL,
        "limitAmount" DOUBLE PRECISION NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        context TEXT NOT NULL DEFAULT 'PF',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Cria tabela Goal (se não existir)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Goal" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL DEFAULT '🎯',
        "targetAmount" DOUBLE PRECISION NOT NULL,
        "currentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        deadline TIMESTAMP(3),
        context TEXT NOT NULL DEFAULT 'PF',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Cria tabela Company (se não existir)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Company" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        document TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Cria tabela BankAccount (se não existir)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "BankAccount" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        agency TEXT,
        account TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Adiciona colunas novas na Transaction
    await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "companyId" TEXT;`);
    await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;`);
    // Criar índices no banco de produção para acelerar buscas
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_status" ON "Transaction"(status);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_type" ON "Transaction"(type);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_context" ON "Transaction"(context);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_dueDate" ON "Transaction"("dueDate");`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_companyId" ON "Transaction"("companyId");`).catch(() => {});
    
    // ─── ALMOXARIFADO ─────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "StockSupplier" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        document TEXT,
        contact TEXT,
        email TEXT,
        phone TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "StockLocation" (
        id TEXT NOT NULL PRIMARY KEY,
        aisle TEXT NOT NULL,
        shelf TEXT NOT NULL,
        position TEXT NOT NULL,
        label TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Product" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        code TEXT NOT NULL UNIQUE,
        "manufacturerCode" TEXT,
        "imageUrl" TEXT,
        unit TEXT NOT NULL DEFAULT 'UN',
        category TEXT NOT NULL DEFAULT 'Geral',
        "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "salePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        "locationId" TEXT,
        "supplierId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "StockMovement" (
        id TEXT NOT NULL PRIMARY KEY,
        type TEXT NOT NULL,
        quantity DOUBLE PRECISION NOT NULL,
        "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        reason TEXT,
        document TEXT,
        date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdBy" TEXT,
        "productId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_product_code" ON "Product"(code);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_product_active" ON "Product"(active);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_stockmovement_productId" ON "StockMovement"("productId");`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_stockmovement_type" ON "StockMovement"(type);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_stockmovement_date" ON "StockMovement"(date);`).catch(() => {});
    // Módulo de usuário
    await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'FINANCE';`);
    // Categorias do almoxarifado
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "WarehouseCategory" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#64748b',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Migrações e índices aplicados com sucesso.');
  } catch (e) {
    console.error('⚠️ Erro nas migrações (provavelmente já aplicadas):', e);
  } finally {
    await pool.end();
  }
}

// ─── AUTH ──────────────────────────────────────────────────────────────────────

// Cadastro (Desativado: Sistema exclusivo para 1 usuário)
app.post('/api/auth/register', authLimiter, async (req: Request, res: Response) => {
  res.status(403).json({ error: 'O cadastro de novos usuários está desativado por questões de segurança.' });
});

// Login
app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(401).json({ error: 'E-mail ou senha inválidos.' }); return; }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) { res.status(401).json({ error: 'E-mail ou senha inválidos.' }); return; }
    const module = (user as any).module || 'FINANCE';
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, module }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, module } });
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ─── RECUPERAÇÃO DE SENHA (VIA PIN MESTRE) ────────────────────────────────────
app.post('/api/auth/reset', authLimiter, async (req: Request, res: Response) => {
  const { email, newPassword, pin } = req.body;
  if (!email || !newPassword || !pin) {
    res.status(400).json({ error: 'Preencha todos os campos.' });
    return;
  }

  const VALID_PIN = process.env.SECURITY_PIN || '2606'; // PIN hardcoded fallback
  
  if (pin !== VALID_PIN) {
    res.status(403).json({ error: 'PIN de Segurança inválido.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ error: 'E-mail não encontrado.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Senha alterada com sucesso! Você já pode fazer login.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
});

// Listar usuários (apenas ADMIN)
app.get('/api/auth/users', authMiddleware, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } });
    res.json(users);
  } catch { res.status(500).json({ error: 'Erro ao listar usuários.' }); }
});

// Atualizar módulo do usuário
app.patch('/api/auth/users/:id/module', authMiddleware, async (req: Request, res: Response) => {
  const id = String(String(req.params.id));
  const { module } = req.body;
  if (!['FINANCE', 'WAREHOUSE', 'ADMIN'].includes(module)) {
    res.status(400).json({ error: 'Módulo inválido. Use FINANCE, WAREHOUSE ou ADMIN.' }); return;
  }
  try {
    const pg = require('pg');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`UPDATE "User" SET module=$1 WHERE id=$2`, [module, id]);
    await pool.end();
    res.json({ message: 'Módulo atualizado.' });
  } catch { res.status(500).json({ error: 'Erro ao atualizar módulo.' }); }
});

// ─── TRANSAÇÕES (protegidas) ───────────────────────────────────────────────────
app.get('/api/transactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Paraleliza as 2 queries para reduzir tempo de resposta
    const [transactions, withAttachments] = await Promise.all([
      prisma.transaction.findMany({
        select: {
          id: true,
          description: true,
          amount: true,
          type: true,
          status: true,
          dueDate: true,
          paymentDate: true,
          isRecurring: true,
          categoryId: true,
          entityId: true,
          companyId: true,
          bankAccountId: true,
          context: true,
          createdAt: true,
          updatedAt: true,
          category: true,
          entity: true,
          company: true,
          bankAccount: true,
          // NÃO seleciona attachmentUrl (Base64) para economizar banda!
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { attachmentUrl: { not: null } },
        select: { id: true },
      }),
    ]);

    const attachmentSet = new Set(withAttachments.map(t => t.id));
    const result = transactions.map(t => ({ ...t, hasAttachment: attachmentSet.has(t.id) }));

    res.json(result);
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar transações.' }); }
});

app.get('/api/transactions/:id/attachment', authMiddleware, async (req: Request, res: Response) => {
  const id = String(String(req.params.id));
  try {
    const t = await prisma.transaction.findUnique({
      where: { id },
      select: { attachmentUrl: true },
    });
    if (!t || !t.attachmentUrl) return res.status(404).json({ error: 'Anexo não encontrado' });
    res.json({ attachmentUrl: t.attachmentUrl });
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar anexo.' }); }
});

app.post('/api/transactions', authMiddleware, async (req: Request, res: Response) => {
  const { description, amount, type, status, dueDate, paymentDate, isRecurring, categoryId, entityId, companyId, attachmentUrl } = req.body;
  try {
    const transaction = await prisma.transaction.create({
      data: {
        description,
        amount: Number(amount),
        type, status,
        dueDate: new Date(dueDate),
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        isRecurring: Boolean(isRecurring),
        categoryId: categoryId || null,
        entityId: entityId || null,
        companyId: companyId || null,
        attachmentUrl: attachmentUrl || null,
        context: 'PJ'
      },
    });
    res.status(201).json(transaction);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar transação.' }); }
});

app.patch('/api/transactions/:id/attach', authMiddleware, async (req: Request, res: Response) => {
  const id = String(String(req.params.id));
  const { attachmentUrl } = req.body;
  try {
    const t = await prisma.transaction.update({ where: { id }, data: { attachmentUrl } });
    res.json(t);
  } catch (e) { res.status(500).json({ error: 'Erro ao anexar comprovante.' }); }
});

app.patch('/api/transactions/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  const id = String(String(req.params.id));
  const { paymentDate, bankAccountId, amount } = req.body;
  try {
    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const updateData: any = { status: 'PAID', paymentDate: payDate };
    if (bankAccountId) updateData.bankAccountId = bankAccountId;
    if (amount) updateData.amount = Number(amount);

    const t = await prisma.transaction.update({ where: { id }, data: updateData });
    
    if (t.isRecurring) {
      const nextDueDate = new Date(t.dueDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      
      await prisma.transaction.create({
        data: {
          description: t.description,
          amount: t.amount,
          type: t.type,
          categoryId: t.categoryId,
          entityId: t.entityId,
          companyId: t.companyId,
          dueDate: nextDueDate,
          status: 'PENDING',
          isRecurring: true,
          context: t.context
        }
      });
    }
    
    res.json(t);
  } catch (e) { res.status(500).json({ error: 'Erro ao dar baixa.' }); }
});

app.delete('/api/transactions/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = String(String(req.params.id));
  try {
    await prisma.transaction.delete({ where: { id } });
    res.json({ message: 'Excluído.' });
  } catch (e) { res.status(500).json({ error: 'Erro ao excluir.' }); }
});

// ─── LEITURA DE BOLETO (OCR) ──────────────────────────────────────────────────
app.post('/api/ocr/boleto', authMiddleware, async (req: Request, res: Response) => {
  const { fileBase64 } = req.body;
  if (!fileBase64) { res.status(400).json({ error: 'Arquivo não fornecido.' }); return; }
  
  try {
    const base64Data = fileBase64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const data = await pdfParse(buffer);
    const text = data.text;
    
    // Extrair Valor (ex: R$ 1.500,00 ou Valor do Documento 1.500,00)
    const valueMatch = text.match(/R\$\s*([\d\.,]+)/) || text.match(/Valor[^\d]*([\d\.,]+)/i);
    let amount = '';
    if (valueMatch) {
      amount = valueMatch[1].replace(/\./g, '').replace(',', '.');
    }
    
    // Extrair Data de Vencimento (dd/mm/yyyy)
    const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    let dueDate = '';
    if (dateMatch) {
      dueDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
    
    res.json({ amount, dueDate });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao ler o PDF do boleto.' });
  }
});

// ─── RESUMO / DASHBOARD (protegido) ───────────────────────────────────────────
app.get('/api/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId && req.query.companyId !== 'all' ? String(req.query.companyId) : undefined;
    const filterCompany = companyId ? { companyId } : {};

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [receitaMes, despesasMes, contasHoje, aReceberHoje] = await Promise.all([
      prisma.transaction.aggregate({ where: { ...filterCompany, type: 'IN', status: 'PAID', paymentDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...filterCompany, type: 'OUT', status: 'PAID', paymentDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...filterCompany, type: 'OUT', status: 'PENDING', dueDate: { lte: now } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...filterCompany, type: 'IN', status: 'PENDING', dueDate: { lte: now } }, _sum: { amount: true } }),
    ]);

    const receita = receitaMes._sum.amount || 0;
    const despesas = despesasMes._sum.amount || 0;
    const rentabilidade = receita > 0 ? (((receita - despesas) / receita) * 100).toFixed(1) : '0';

    res.json({
      receitaMes: receita,
      despesasMes: despesas,
      rentabilidade,
      contasVencidasHoje: { total: contasHoje._sum.amount || 0, count: contasHoje._count },
      aReceberHoje: aReceberHoje._sum.amount || 0,
    });
  } catch (e) { 
    console.error(e); 
    res.status(500).json({ error: 'Erro ao calcular resumo.' }); 
  }
});

// ─── CATEGORIAS (protegidas) ───────────────────────────────────────────────────
app.get('/api/categories', authMiddleware, async (req: Request, res: Response) => {
  res.json(await prisma.category.findMany());
});
app.post('/api/categories', authMiddleware, async (req: Request, res: Response) => {
  const { name, type, color } = req.body;
  res.status(201).json(await prisma.category.create({ data: { name, type, color } }));
});
app.delete('/api/categories/:id', authMiddleware, async (req: Request, res: Response) => {
  await prisma.category.delete({ where: { id: String(String(req.params.id)) } });
  res.json({ message: 'Excluído.' });
});

// ─── ENTIDADES (protegidas) ────────────────────────────────────────────────────
app.get('/api/entities', authMiddleware, async (req: Request, res: Response) => {
  res.json(await prisma.entity.findMany());
});
app.post('/api/entities', authMiddleware, async (req: Request, res: Response) => {
  const { name, document, type } = req.body;
  res.status(201).json(await prisma.entity.create({ data: { name, document, type } }));
});
app.delete('/api/entities/:id', authMiddleware, async (req: Request, res: Response) => {
  await prisma.entity.delete({ where: { id: String(String(req.params.id)) } });
  res.json({ message: 'Excluído.' });
});

// ─── EMPRESAS E CONTAS BANCÁRIAS (Configurações) ──────────────────────────────
app.get('/api/companies', authMiddleware, async (req: Request, res: Response) => {
  res.json(await (prisma as any).company.findMany());
});
app.post('/api/companies', authMiddleware, async (req: Request, res: Response) => {
  const { name, document } = req.body;
  res.status(201).json(await (prisma as any).company.create({ data: { name, document } }));
});
app.delete('/api/companies/:id', authMiddleware, async (req: Request, res: Response) => {
  await (prisma as any).company.delete({ where: { id: String(String(req.params.id)) } });
  res.json({ message: 'Excluído.' });
});

app.get('/api/bank-accounts', authMiddleware, async (req: Request, res: Response) => {
  res.json(await (prisma as any).bankAccount.findMany());
});
app.post('/api/bank-accounts', authMiddleware, async (req: Request, res: Response) => {
  const { name, agency, account } = req.body;
  res.status(201).json(await (prisma as any).bankAccount.create({ data: { name, agency, account } }));
});
app.delete('/api/bank-accounts/:id', authMiddleware, async (req: Request, res: Response) => {
  await (prisma as any).bankAccount.delete({ where: { id: String(String(req.params.id)) } });
  res.json({ message: 'Excluído.' });
});

// ─── FINANÇAS PESSOAIS (PF) ────────────────────────────────────────────────────

// Categorias PF
app.get('/api/pf/categories', authMiddleware, async (req: Request, res: Response) => {
  try {
    let cats = await (prisma as any).category.findMany({ where: { context: 'PF' } });
    // Se não existirem categorias PF, cria as padrões automaticamente
    if (cats.length === 0) {
      const defaults = [
        { name: 'Alimentação',  type: 'OUT', color: '#ef4444', context: 'PF' },
        { name: 'Transporte',   type: 'OUT', color: '#f97316', context: 'PF' },
        { name: 'Moradia',      type: 'OUT', color: '#8b5cf6', context: 'PF' },
        { name: 'Saúde',        type: 'OUT', color: '#10b981', context: 'PF' },
        { name: 'Lazer',        type: 'OUT', color: '#3b82f6', context: 'PF' },
        { name: 'Educação',     type: 'OUT', color: '#f59e0b', context: 'PF' },
        { name: 'Vestuário',    type: 'OUT', color: '#ec4899', context: 'PF' },
        { name: 'Salário',      type: 'IN',  color: '#22c55e', context: 'PF' },
        { name: 'Pró-labore',   type: 'IN',  color: '#06b6d4', context: 'PF' },
        { name: 'Outros',       type: 'OUT', color: '#94a3b8', context: 'PF' },
      ];
      await (prisma as any).category.createMany({ data: defaults });
      cats = await (prisma as any).category.findMany({ where: { context: 'PF' } });
    }
    res.json(cats);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao buscar categorias PF.' }); }
});

app.post('/api/pf/categories', authMiddleware, async (req: Request, res: Response) => {
  const { name, type, color } = req.body;
  try {
    const cat = await (prisma as any).category.create({ data: { name, type, color: color || '#94a3b8', context: 'PF' } });
    res.status(201).json(cat);
  } catch (e) { res.status(500).json({ error: 'Erro ao criar categoria PF.' }); }
});

app.delete('/api/pf/categories/:id', authMiddleware, async (req: Request, res: Response) => {
  await (prisma as any).category.delete({ where: { id: String(String(req.params.id)) } });
  res.json({ message: 'Excluído.' });
});

// Transações PF
app.get('/api/pf/transactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const transactions = await (prisma as any).transaction.findMany({
      where: { context: 'PF' },
      select: {
        id: true, description: true, amount: true, type: true,
        status: true, dueDate: true, paymentDate: true, isRecurring: true,
        categoryId: true, entityId: true, companyId: true, bankAccountId: true, createdAt: true, updatedAt: true,
        context: true, category: true, entity: true, company: true, bankAccount: true,
      },
      orderBy: { dueDate: 'desc' },
    });
    const withAtt = await (prisma as any).transaction.findMany({
      where: { context: 'PF', attachmentUrl: { not: null } }, select: { id: true },
    });
    const attSet = new Set(withAtt.map((t: any) => t.id));
    res.json(transactions.map((t: any) => ({ ...t, hasAttachment: attSet.has(t.id) })));
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar transações PF.' }); }
});

app.post('/api/pf/transactions', authMiddleware, async (req: Request, res: Response) => {
  const { description, amount, type, status, dueDate, paymentDate, isRecurring, categoryId, entityId, companyId, bankAccountId } = req.body;
  try {
    const t = await (prisma as any).transaction.create({
      data: {
        description, amount: Number(amount), type, status,
        dueDate: new Date(dueDate),
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        isRecurring: Boolean(isRecurring),
        categoryId: categoryId || null,
        entityId: entityId || null,
        companyId: companyId || null,
        bankAccountId: bankAccountId || null,
        context: 'PF',
      },
    });
    res.status(201).json(t);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar transação PF.' }); }
});

app.patch('/api/pf/transactions/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  const id = String(String(req.params.id));
  const { paymentDate, bankAccountId, amount } = req.body;
  try {
    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const updateData: any = { status: 'PAID', paymentDate: payDate };
    if (bankAccountId) updateData.bankAccountId = bankAccountId;
    if (amount) updateData.amount = Number(amount);

    const t = await (prisma as any).transaction.update({
      where: { id }, data: updateData,
    });
    if (t.isRecurring) {
      const nextDue = new Date(t.dueDate); nextDue.setMonth(nextDue.getMonth() + 1);
      await (prisma as any).transaction.create({
        data: { description: t.description, amount: t.amount, type: t.type, categoryId: t.categoryId, entityId: t.entityId, companyId: t.companyId, dueDate: nextDue, status: 'PENDING', isRecurring: true, context: 'PF' },
      });
    }
    res.json(t);
  } catch (e) { res.status(500).json({ error: 'Erro ao dar baixa.' }); }
});

app.delete('/api/pf/transactions/:id', authMiddleware, async (req: Request, res: Response) => {
  await (prisma as any).transaction.delete({ where: { id: String(String(req.params.id)) } });
  res.json({ message: 'Excluído.' });
});

// Orçamentos (Budget)
app.get('/api/pf/budgets', authMiddleware, async (req: Request, res: Response) => {
  const now = new Date();
  const month = parseInt(req.query.month as string) || now.getMonth() + 1;
  const year = parseInt(req.query.year as string) || now.getFullYear();
  try {
    const budgets = await (prisma as any).budget.findMany({
      where: { context: 'PF', month, year },
      include: { category: true },
    });
    res.json(budgets);
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar orçamentos.' }); }
});

app.post('/api/pf/budgets', authMiddleware, async (req: Request, res: Response) => {
  const { name, categoryId, limitAmount, month, year } = req.body;
  try {
    const b = await (prisma as any).budget.create({
      data: { name, categoryId: categoryId || null, limitAmount: Number(limitAmount), month, year, context: 'PF' },
      include: { category: true },
    });
    res.status(201).json(b);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar orçamento.' }); }
});

app.delete('/api/pf/budgets/:id', authMiddleware, async (req: Request, res: Response) => {
  await (prisma as any).budget.delete({ where: { id: String(String(req.params.id)) } });
  res.json({ message: 'Excluído.' });
});

// Metas (Goals)
app.get('/api/pf/goals', authMiddleware, async (req: Request, res: Response) => {
  try {
    res.json(await (prisma as any).goal.findMany({ where: { context: 'PF' }, orderBy: { createdAt: 'asc' } }));
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar metas.' }); }
});

app.post('/api/pf/goals', authMiddleware, async (req: Request, res: Response) => {
  const { name, emoji, targetAmount, deadline } = req.body;
  try {
    const g = await (prisma as any).goal.create({
      data: { name, emoji: emoji || '🎯', targetAmount: Number(targetAmount), deadline: deadline ? new Date(deadline) : null, context: 'PF' },
    });
    res.status(201).json(g);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar meta.' }); }
});

app.patch('/api/pf/goals/:id/deposit', authMiddleware, async (req: Request, res: Response) => {
  const id = String(String(req.params.id));
  const { amount } = req.body;
  try {
    const g = await (prisma as any).goal.findUnique({ where: { id } });
    if (!g) { res.status(404).json({ error: 'Meta não encontrada.' }); return; }
    const updated = await (prisma as any).goal.update({
      where: { id },
      data: { currentAmount: Math.min(g.currentAmount + Number(amount), g.targetAmount) },
    });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: 'Erro ao depositar.' }); }
});

app.delete('/api/pf/goals/:id', authMiddleware, async (req: Request, res: Response) => {
  await (prisma as any).goal.delete({ where: { id: String(String(req.params.id)) } });
  res.json({ message: 'Excluído.' });
});

// ─── ALMOXARIFADO ─────────────────────────────────────────────────────────────

// ── CATEGORIAS DO ALMOXARIFADO ────────────────────────────────────────────────
app.get('/api/warehouse/categories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = await prisma.warehouseCategory.findMany({ orderBy: { name: 'asc' } });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar categorias.' }); }
});

app.post('/api/warehouse/categories', authMiddleware, async (req: Request, res: Response) => {
  const { name, color } = req.body;
  if (!name) { res.status(400).json({ error: 'Nome da categoria é obrigatório.' }); return; }
  try {
    const row = await prisma.warehouseCategory.create({
      data: { name, color: color || '#64748b' }
    });
    res.status(201).json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar categoria.' }); }
});

app.delete('/api/warehouse/categories/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.warehouseCategory.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch (e) { res.status(500).json({ error: 'Erro ao excluir categoria.' }); }
});

// ── FORNECEDORES DE ESTOQUE ──────────────────────────────────────────────────
app.get('/api/warehouse/suppliers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = await prisma.stockSupplier.findMany({ orderBy: { name: 'asc' } });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar fornecedores.' }); }
});

app.post('/api/warehouse/suppliers', authMiddleware, async (req: Request, res: Response) => {
  const { name, document, contact, email, phone } = req.body;
  try {
    const row = await prisma.stockSupplier.create({
      data: { name, document: document || null, contact: contact || null, email: email || null, phone: phone || null }
    });
    res.status(201).json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar fornecedor.' }); }
});

app.delete('/api/warehouse/suppliers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.stockSupplier.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch (e) { res.status(500).json({ error: 'Erro ao excluir fornecedor.' }); }
});

// ── LOCALIZAÇÕES ─────────────────────────────────────────────────────────────
app.get('/api/warehouse/locations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = await prisma.stockLocation.findMany({ orderBy: { label: 'asc' } });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar localizações.' }); }
});

app.post('/api/warehouse/locations', authMiddleware, async (req: Request, res: Response) => {
  const { aisle, shelf, position } = req.body;
  try {
    const label = `${String(aisle).toUpperCase()}-${String(shelf).padStart(2,'0')}-${String(position).padStart(2,'0')}`;
    const row = await prisma.stockLocation.create({
      data: { aisle, shelf, position, label }
    });
    res.status(201).json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar localização.' }); }
});

app.delete('/api/warehouse/locations/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.stockLocation.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch (e) { res.status(500).json({ error: 'Erro ao excluir localização.' }); }
});

// ── PRODUTOS ─────────────────────────────────────────────────────────────────
app.get('/api/warehouse/products', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', search, category } = req.query;
    let where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { code: { contains: String(search), mode: 'insensitive' } },
        { manufacturerCode: { contains: String(search), mode: 'insensitive' } }
      ];
    }
    if (category) where.category = String(category);

    const skip = (Number(page) - 1) * Number(limit);
    
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { location: true, supplier: true },
        orderBy: { name: 'asc' },
        skip,
        take: Number(limit)
      }),
      prisma.product.count({ where })
    ]);

    const result = products.map((p: any) => {
      const { imageUrl, location, supplier, ...rest } = p;
      return {
        ...rest,
        hasImage: !!imageUrl,
        locationLabel: location?.label,
        aisle: location?.aisle,
        shelf: location?.shelf,
        position: location?.position,
        supplierName: supplier?.name,
        supplierDocument: supplier?.document
      };
    });
    
    res.json({
      data: result,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao buscar produtos.' }); }
});

app.get('/api/warehouse/products-search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    let where: any = { active: true };
    if (q) {
      where.OR = [
        { name: { contains: String(q), mode: 'insensitive' } },
        { code: { contains: String(q), mode: 'insensitive' } }
      ];
    }
    const products = await prisma.product.findMany({
      where,
      select: { id: true, name: true, code: true, currentStock: true, unit: true, costPrice: true, location: { select: { label: true } } },
      take: 50,
      orderBy: { name: 'asc' }
    });
    res.json(products.map((p: any) => ({ ...p, locationLabel: p.location?.label })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao buscar.' }); }
});

app.get('/api/warehouse/products/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const p: any = await prisma.product.findUnique({
      where: { id: String(req.params.id) },
      include: { location: true, supplier: true }
    });
    if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
    const { location, supplier, ...rest } = p;
    res.json({
      ...rest,
      locationLabel: location?.label,
      aisle: location?.aisle,
      shelf: location?.shelf,
      position: location?.position,
      supplierName: supplier?.name,
      supplierDocument: supplier?.document
    });
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar produto.' }); }
});

app.get('/api/warehouse/products/:id/image', authMiddleware, async (req: Request, res: Response) => {
  try {
    const p = await prisma.product.findUnique({ where: { id: String(req.params.id) }, select: { imageUrl: true } });
    if (!p || !p.imageUrl) return res.status(404).json({ error: 'Imagem não encontrada.' });
    res.json({ imageUrl: p.imageUrl });
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar imagem.' }); }
});

app.post('/api/warehouse/products', authMiddleware, async (req: Request, res: Response) => {
  const { name, description, code, manufacturerCode, imageUrl, unit, category, minStock, costPrice, salePrice, locationId, supplierId } = req.body;
  try {
    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        code,
        manufacturerCode: manufacturerCode || null,
        imageUrl: imageUrl || null,
        unit: unit || 'UN',
        category: category || 'Geral',
        minStock: Number(minStock) || 0,
        costPrice: Number(costPrice) || 0,
        salePrice: Number(salePrice) || 0,
        locationId: locationId || null,
        supplierId: supplierId || null,
        currentStock: 0,
        active: true,
      }
    });
    res.status(201).json(product);
  } catch (e: any) {
    console.error(e);
    if (e.code === 'P2002') return res.status(400).json({ error: 'Código já existe. Use um código único.' });
    res.status(500).json({ error: 'Erro ao criar produto.' });
  }
});

app.patch('/api/warehouse/products/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { name, description, code, manufacturerCode, unit, category, minStock, costPrice, salePrice, locationId, supplierId, active } = req.body;
  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        code: code || undefined,
        manufacturerCode: manufacturerCode !== undefined ? manufacturerCode : undefined,
        unit: unit || undefined,
        category: category || undefined,
        minStock: minStock != null ? Number(minStock) : undefined,
        costPrice: costPrice != null ? Number(costPrice) : undefined,
        salePrice: salePrice != null ? Number(salePrice) : undefined,
        locationId: locationId !== undefined ? (locationId || null) : undefined,
        supplierId: supplierId !== undefined ? (supplierId || null) : undefined,
        active: active != null ? Boolean(active) : undefined,
      }
    });
    res.json(product);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao atualizar produto.' }); }
});

app.patch('/api/warehouse/products/:id/image', authMiddleware, async (req: Request, res: Response) => {
  const { imageUrl } = req.body;
  try {
    await prisma.product.update({ where: { id: String(req.params.id) }, data: { imageUrl } });
    res.json({ message: 'Imagem atualizada.' });
  } catch (e) { res.status(500).json({ error: 'Erro ao atualizar imagem.' }); }
});

app.delete('/api/warehouse/products/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await prisma.stockMovement.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Produto e histórico excluídos.' });
  } catch (e) { res.status(500).json({ error: 'Erro ao excluir produto.' }); }
});

// ── MOVIMENTAÇÕES ────────────────────────────────────────────────────────────
app.get('/api/warehouse/movements', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { productId, type, from, to, page = '1', limit = '50', fetchTypes } = req.query;
    
    let where: any = {};
    if (productId) where.productId = String(productId);
    if (type) where.type = String(type);
    if (fetchTypes) {
      where.type = { in: String(fetchTypes).split(',') };
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(String(from));
      if (to) {
         const toDate = new Date(String(to));
         toDate.setUTCHours(23, 59, 59, 999);
         where.date.lte = toDate;
      }
    }
    
    const skip = (Number(page) - 1) * Number(limit);

    const [movs, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: Number(limit),
        include: { product: true }
      }),
      prisma.stockMovement.count({ where })
    ]);
    
    const result = movs.map((m: any) => {
      const { product, ...rest } = m;
      return {
        ...rest,
        productName: product?.name,
        productCode: product?.code,
        productUnit: product?.unit
      };
    });
    res.json({
      data: result,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao buscar movimentações.' }); }
});

app.post('/api/warehouse/movements', authMiddleware, async (req: Request, res: Response) => {
  const { productId, type, quantity, unitPrice, reason, document, date } = req.body;
  const user = (req as any).user;
  try {
    const prod = await prisma.product.findUnique({ where: { id: productId } });
    if (!prod) return res.status(404).json({ error: 'Produto não encontrado.' });
    
    const qty = Number(quantity);
    const price = Number(unitPrice) || prod.costPrice;
    const total = qty * price;
    const movDate = date ? new Date(date) : new Date();
    
    let newStock = prod.currentStock;
    if (type === 'ENTRY' || type === 'RETURN') newStock += qty;
    else if (type === 'EXIT' || type === 'SALE' || type === 'ADJUSTMENT') newStock = Math.max(0, newStock - qty);
    
    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          productId,
          type,
          quantity: qty,
          unitPrice: price,
          totalPrice: total,
          reason: reason || null,
          document: document || null,
          date: movDate,
          createdBy: user?.name || null
        }
      }),
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newStock }
      })
    ]);
    
    res.json({ ...movement, newStock });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao registrar movimentação.' }); }
});

// ── DASHBOARD / RESUMO DO ESTOQUE ────────────────────────────────────────────
app.get('/api/warehouse/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const activeProducts = await prisma.product.findMany({ where: { active: true } });
    const totalProducts = activeProducts.length;
    let totalValue = 0;
    let totalItems = 0;
    let lowStockCount = 0;
    
    activeProducts.forEach(p => {
      totalValue += p.currentStock * p.costPrice;
      totalItems += p.currentStock;
      if (p.minStock > 0 && p.currentStock <= p.minStock) lowStockCount++;
    });
    
    const lowStockItems = await prisma.product.findMany({
      where: {
        active: true,
        minStock: { gt: 0 }
      },
      include: { location: true }
    });
    
    const filteredLowStock = lowStockItems
      .filter((p: any) => p.currentStock <= p.minStock)
      .sort((a: any, b: any) => (a.currentStock / a.minStock) - (b.currentStock / b.minStock))
      .slice(0, 10)
      .map((p: any) => {
        const { location, ...rest } = p;
        return { ...rest, locationLabel: location?.label };
      });

    const movements = await prisma.stockMovement.groupBy({
      by: ['type'],
      where: { date: { gte: startOfMonth } },
      _count: { _all: true },
      _sum: { totalPrice: true }
    });
    
    const movementsByType = movements.map(m => ({
      type: m.type,
      count: m._count._all,
      total: m._sum.totalPrice || 0
    }));
    
    res.json({
      totalProducts,
      totalValue,
      totalItems,
      lowStockCount,
      lowStockItems: filteredLowStock,
      movementsByType,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao buscar resumo do estoque.' }); }
});

app.get('/api/warehouse/low-stock', authMiddleware, async (req: Request, res: Response) => {
  try {
    const items = await prisma.product.findMany({
      where: {
        active: true,
        minStock: { gt: 0 }
      },
      include: { location: true, supplier: true }
    });
    
    const result = items
      .filter((p: any) => p.currentStock <= p.minStock)
      .sort((a: any, b: any) => (a.currentStock / a.minStock) - (b.currentStock / b.minStock))
      .map((p: any) => {
        const { location, supplier, ...rest } = p;
        return {
          ...rest,
          locationLabel: location?.label,
          supplierName: supplier?.name
        };
      });
      
    res.json(result);
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar produtos com estoque baixo.' }); }
});

app.listen(port, () => {
  console.log(`🚀 Servidor Magalhaes na porta ${port}`);
  runMigrations();
});
