import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Rotas de Transações (Fluxo de Caixa) ---

// Listar todas as transações
app.get('/api/transactions', async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        category: true,
        entity: true,
      },
      orderBy: { dueDate: 'asc' },
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar transações.' });
  }
});

// Criar nova transação (Conta a Pagar/Receber ou Histórico)
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
        categoryId,
        entityId,
      },
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar transação.' });
  }
});

// Marcar como pago
app.patch('/api/transactions/:id/pay', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const transaction = await prisma.transaction.update({
      where: { id },
      data: { 
        status: 'PAID',
        paymentDate: new Date()
      },
    });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao dar baixa na transação.' });
  }
});

// --- Rotas de Categorias ---

app.get('/api/categories', async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany();
  res.json(categories);
});

app.post('/api/categories', async (req: Request, res: Response) => {
  const { name, type, color } = req.body;
  const category = await prisma.category.create({ data: { name, type, color } });
  res.status(201).json(category);
});

// --- Teste de Conexão ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend operacional', database: 'PostgreSQL configurado' });
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
