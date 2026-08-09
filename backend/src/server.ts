import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'magalhaes-secret-key-change-in-production';

app.use(cors({ origin: process.env.FRONTEND_URL || '*', methods: ['GET','POST','PATCH','DELETE','PUT'] }));
app.use(express.json());

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

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: '✅ Backend Magalhaes operacional', database: 'PostgreSQL via Neon' });
});

// ─── AUTH ──────────────────────────────────────────────────────────────────────

// Cadastro (apenas o primeiro acesso cria o usuário)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) { res.status(400).json({ error: 'E-mail já cadastrado.' }); return; }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, password: hashed } });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao cadastrar.' });
  }
});

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(401).json({ error: 'E-mail ou senha inválidos.' }); return; }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) { res.status(401).json({ error: 'E-mail ou senha inválidos.' }); return; }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

// ─── TRANSAÇÕES (protegidas) ───────────────────────────────────────────────────
app.get('/api/transactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { category: true, entity: true },
      orderBy: { dueDate: 'asc' },
    });
    res.json(transactions);
  } catch (e) { res.status(500).json({ error: 'Erro ao buscar transações.' }); }
});

app.post('/api/transactions', authMiddleware, async (req: Request, res: Response) => {
  const { description, amount, type, status, dueDate, paymentDate, isRecurring, categoryId, entityId } = req.body;
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
      },
    });
    res.status(201).json(transaction);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar transação.' }); }
});

app.patch('/api/transactions/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const t = await prisma.transaction.update({ where: { id }, data: { status: 'PAID', paymentDate: new Date() } });
    res.json(t);
  } catch (e) { res.status(500).json({ error: 'Erro ao dar baixa.' }); }
});

app.delete('/api/transactions/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.transaction.delete({ where: { id } });
    res.json({ message: 'Excluído.' });
  } catch (e) { res.status(500).json({ error: 'Erro ao excluir.' }); }
});

// ─── RESUMO / DASHBOARD (protegido) ───────────────────────────────────────────
app.get('/api/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const [receitaMes, despesasMes, contasHoje, aReceberHoje] = await Promise.all([
      prisma.transaction.aggregate({ where: { type: 'IN', status: 'PAID', paymentDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'OUT', status: 'PAID', paymentDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'OUT', status: 'PENDING', dueDate: { lte: now } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { type: 'IN', status: 'PENDING', dueDate: { lte: now } }, _sum: { amount: true } }),
    ]);
    const receita = receitaMes._sum.amount || 0;
    const despesas = despesasMes._sum.amount || 0;
    const rentabilidade = receita > 0 ? (((receita - despesas) / receita) * 100).toFixed(1) : '0';
    res.json({
      receitaMes: receita, despesasMes: despesas, rentabilidade,
      contasVencidasHoje: { total: contasHoje._sum.amount || 0, count: contasHoje._count },
      aReceberHoje: aReceberHoje._sum.amount || 0,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao calcular resumo.' }); }
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
  await prisma.category.delete({ where: { id: req.params.id } });
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
  await prisma.entity.delete({ where: { id: req.params.id } });
  res.json({ message: 'Excluído.' });
});

app.listen(port, () => console.log(`🚀 Servidor Magalhaes na porta ${port}`));
