import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
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
app.use(express.json({ limit: '10mb' }));

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

// Cadastro (Desativado: Sistema exclusivo para 1 usuário)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  res.status(403).json({ error: 'O cadastro de novos usuários está desativado por questões de segurança.' });
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
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ─── RECUPERAÇÃO DE SENHA (VIA PIN MESTRE) ────────────────────────────────────
app.post('/api/auth/reset', async (req: Request, res: Response) => {
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
  const { description, amount, type, status, dueDate, paymentDate, isRecurring, categoryId, entityId, attachmentUrl } = req.body;
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
        attachmentUrl: attachmentUrl || null,
      },
    });
    res.status(201).json(transaction);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Erro ao criar transação.' }); }
});

app.patch('/api/transactions/:id/attach', authMiddleware, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { attachmentUrl } = req.body;
  try {
    const t = await prisma.transaction.update({ where: { id }, data: { attachmentUrl } });
    res.json(t);
  } catch (e) { res.status(500).json({ error: 'Erro ao anexar comprovante.' }); }
});

app.patch('/api/transactions/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const t = await prisma.transaction.update({ where: { id }, data: { status: 'PAID', paymentDate: new Date() } });
    
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
          dueDate: nextDueDate,
          status: 'PENDING',
          isRecurring: true
        }
      });
    }
    
    res.json(t);
  } catch (e) { res.status(500).json({ error: 'Erro ao dar baixa.' }); }
});

app.delete('/api/transactions/:id', authMiddleware, async (req: Request, res: Response) => {
  const id = String(req.params.id);
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
  await prisma.category.delete({ where: { id: String(req.params.id) } });
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
  await prisma.entity.delete({ where: { id: String(req.params.id) } });
  res.json({ message: 'Excluído.' });
});

app.listen(port, () => console.log(`🚀 Servidor Magalhaes na porta ${port}`));
