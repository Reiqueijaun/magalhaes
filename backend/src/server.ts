import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const app = express();
const port = process.env.PORT || 3001;

// Permite chamadas do frontend (localhost em dev, e o domínio da Vercel em produção)
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json());

// --- Health Check ---
app.get('/api/health', async (req, res) => {
  res.json({ status: '✅ Backend Magalhaes operacional', database: 'PostgreSQL via Neon' });
});

// --- TRANSAÇÕES ---
app.get('/api/transactions', async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { category: true, entity: true },
      orderBy: { dueDate: 'asc' },
    });
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar transações.' });
  }
});

app.post('/api/transactions', async (req: Request, res: Response) => {
  const { description, amount, type, status, dueDate, isRecurring, categoryId, entityId } = req.body;
  try {
    const transaction = await prisma.transaction.create({
      data: {
        description,
        amount: Number(amount),
        type,
        status,
        dueDate: new Date(dueDate),
        isRecurring: Boolean(isRecurring),
        categoryId: categoryId || null,
        entityId: entityId || null,
      },
    });
    res.status(201).json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar transação.' });
  }
});

app.patch('/api/transactions/:id/pay', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const transaction = await prisma.transaction.update({
      where: { id },
      data: { status: 'PAID', paymentDate: new Date() },
    });
    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao dar baixa.' });
  }
});

// --- CATEGORIAS ---
app.get('/api/categories', async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany();
  res.json(categories);
});

app.post('/api/categories', async (req: Request, res: Response) => {
  const { name, type, color } = req.body;
  const category = await prisma.category.create({ data: { name, type, color } });
  res.status(201).json(category);
});

app.delete('/api/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.category.delete({ where: { id } });
  res.json({ message: 'Categoria excluída.' });
});

// --- ENTIDADES (Fornecedores/Clientes) ---
app.get('/api/entities', async (req: Request, res: Response) => {
  const entities = await prisma.entity.findMany();
  res.json(entities);
});

app.post('/api/entities', async (req: Request, res: Response) => {
  const { name, document, type } = req.body;
  const entity = await prisma.entity.create({ data: { name, document, type } });
  res.status(201).json(entity);
});

app.delete('/api/entities/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.entity.delete({ where: { id } });
  res.json({ message: 'Entidade excluída.' });
});

// --- RESUMO / DASHBOARD ---
app.get('/api/summary', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [receitaMes, despesasMes, contasHoje, aReceberHoje] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'IN', status: 'PAID', paymentDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'OUT', status: 'PAID', paymentDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'OUT', status: 'PENDING', dueDate: { lte: now } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'IN', status: 'PENDING', dueDate: { lte: now } },
        _sum: { amount: true },
      }),
    ]);

    const receita = receitaMes._sum.amount || 0;
    const despesas = despesasMes._sum.amount || 0;
    const rentabilidade = receita > 0 ? (((receita - despesas) / receita) * 100).toFixed(1) : 0;

    res.json({
      receitaMes: receita,
      despesasMes: despesas,
      rentabilidade,
      contasVencidasHoje: {
        total: contasHoje._sum.amount || 0,
        count: contasHoje._count,
      },
      aReceberHoje: aReceberHoje._sum.amount || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao calcular resumo.' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor Magalhaes rodando na porta ${port}`);
});
