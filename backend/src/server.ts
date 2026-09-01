import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
const pdfParse = require('pdf-parse');
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ─── INICIALIZAÇÃO DE BANCO E SEGURANÇA ─────────────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const app = express();
app.set('trust proxy', 1); // Confia no proxy reverso Nginx para identificar IPs reais
const port = process.env.PORT || 3001;

// Validação de Chave Secreta JWT
const _jwtRaw = process.env.JWT_SECRET;
if (!_jwtRaw || _jwtRaw.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    console.error('? [FATAL] JWT_SECRET ausente ou fraca em producao. Configure .env com minimo 32 chars.');
    process.exit(1);
  } else {
    console.warn('??  [DEV] JWT_SECRET fraca � apenas para desenvolvimento!');
  }
}
const JWT_SECRET = _jwtRaw || 'dev-only-unsafe-key-NOT-for-production';

// VULN-02: Blacklist de tokens revogados (em memória — limpa a cada restart)
// Para producao com multiplas instancias, usar Redis.
const revokedTokens = new Set<string>();

// Valida e limpa valores monet�rios � previne Infinity, NaN e valores absurdos
function sanitizeAmount(value: any, max: number = 999_999_999.99): number {
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.min(Math.abs(n), max);
}

// PIN Mestre para Recuperação de Senha (Sem valor padrão inseguro)
const SECURITY_PIN = process.env.SECURITY_PIN;
// Compara��o de strings em tempo constante (previne timing attacks)
function safeStringEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1)); // dummy para tempo constante
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch { return false; }
}

// Valida��o de formato de e-mail
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
function isValidEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_REGEX.test(email) && email.length <= 254;
}

// Valida��o de URL segura (https ou http para imagens internas)
function isSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch { return false; }
}

// ─── CORS RESTRITIVO E CONTROLADO ──────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : isProd
    ? ['https://magalhaes.online', 'https://www.magalhaes.online']
    : ['https://magalhaes.online', 'https://www.magalhaes.online',
       'http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001',
       'http://127.0.0.1:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (como mobile apps, curl ou requisições server-to-server locais)
    // VULN-05: Em producao, bloquear requests sem Origin (ex: scripts curl/wget nao autorizados)
    if (!origin) {
      if (isProd) return callback(new Error('Bloqueado pela politica de CORS'));
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Bloqueado pela política de CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// ─── BLINDAGEM DE CABEÇALHOS HTTP (HELMET & CSP) ───────────────────────────────
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://magalhaes.online", "https://*.magalhaes.online", "http://localhost:*", "http://127.0.0.1:*"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Prevenção de Poluição de Parâmetros HTTP
app.use(hpp());

// Compressão de Payload
// Protecao contra compression bomb
app.use(compression({ filter: (req, res) => { const cl = parseInt(req.headers['content-length'] || '0', 10); if (cl > 2 * 1024 * 1024) return false; return compression.filter(req, res); } }));

// Limitação de Tamanho de Body (Anti-DoS)
app.use(express.json({ limit: '1mb' }));

// ─── RATE LIMITERS MULTINÍVEL ──────────────────────────────────────────────────
// Limite Global da API (200 reqs / 15 min / IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas requisições deste IP. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Limite Estrito para Login e Recuperação de Senha (Anti-Força Bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas inválidas. Por segurança, aguarde 15 minutos antes de tentar novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite Dedicado para OCR (Evita exaustão de CPU por processamento de PDFs)
const ocrLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  message: { error: 'Limite de processamento de boletos atingido. Aguarde um minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── WAF & FILTRO ANTI-SQL INJECTION & SANITIZAÇÃO ─────────────────────────────
const SQLI_PATTERNS = [
  /\bunion(\s+all)?\s+select\b/i,
  /\b(select|insert|update|delete|drop|alter|truncate|create|exec|execute)\s+\w+.*\b(from|into|table|database)\b/i,
  /(\b(pg_sleep|sleep|waitfor\s+delay|benchmark)\s*\()/i,
  /(\b(information_schema|pg_catalog|pg_tables|pg_user)\b)/i,
  /(;\s*(drop|delete|truncate|alter|insert|update)\s+)/i,
  /(\'\s*or\s*\'?1\'?\s*=\s*\'?1)/i,
  /(\"\s*or\s*\"?1\"?\s*=\s*\"?1)/i,
  /(\b(or|and)\b\s+1\s*=\s*1)/i,
  /-{2,}\s*$|\/\*/m,
];

function hasSqlInjection(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    // Ignora payloads base64 legítimos e extensos para evitar falsos positivos
    if (value.startsWith('data:') && value.length > 500) return false;
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(value)) return true;
    }
    return false;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (hasSqlInjection(key) || hasSqlInjection(value[key])) {
        return true;
      }
    }
  }
  return false;
}

const antiSqlInjectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (hasSqlInjection(req.query) || hasSqlInjection(req.params) || hasSqlInjection(req.body)) {
    console.warn(`🚨 [WAF ANTI-SQLI] Tentativa bloqueada do IP ${req.ip} em ${req.method} ${req.originalUrl}`);
    res.status(400).json({ error: 'Requisição inválida ou parâmetros bloqueados pelo firewall de segurança.' });
    return;
  }
  next();
};
app.use(antiSqlInjectionMiddleware);

// Sanitização de Inputs (Remove bytes nulos e espaços extras)
const PROTO_BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);
const sanitizeInputs = (req: Request, _res: Response, next: NextFunction) => {
  const clean = (obj: any, depth: number = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 5) return;
    for (const key of Object.keys(obj)) {
      if (PROTO_BLOCKED.has(key)) { delete obj[key]; continue; } // bloqueia prototype pollution
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/\0/g, '').trim();
      } else if (typeof obj[key] === 'object') {
        clean(obj[key], depth + 1);
      }
    }
  };
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
};
app.use(sanitizeInputs);

// Validação Estrita de Parâmetros UUIDv4
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validateUuidParam = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const val = String(req.params[paramName] ?? '');
    if (val && !UUID_V4_REGEX.test(val)) {
      res.status(400).json({ error: `Identificador (${paramName}) inválido.` });
      return;
    }
    next();
  };
};

// ─── MIDDLEWARES DE AUTENTICAÇÃO E CONTROLE DE ACESSO (RBAC) ───────────────────
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    return;
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
    // VULN-02: Verificar se o token foi revogado (logout)
    if (decoded.jti && revokedTokens.has(decoded.jti)) {
      res.status(401).json({ error: 'Sessao invalida ou expirada. Faca login novamente.' });
      return;
    }
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
};

const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || (user.module !== 'ADMIN' && user.role !== 'ADMIN')) {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores têm permissão.' });
    return;
  }
  next();
};

const financeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const mod = user?.module;
  if (!mod || (mod !== 'FINANCE' && mod !== 'ADMIN' && user?.role !== 'ADMIN')) {
    res.status(403).json({ error: 'Acesso negado. Permissão para o módulo financeiro necessária.' });
    return;
  }
  next();
};

const warehouseMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const mod = user?.module;
  if (!mod || (mod !== 'WAREHOUSE' && mod !== 'ADMIN' && user?.role !== 'ADMIN')) {
    res.status(403).json({ error: 'Acesso negado. Permissão para o almoxarifado necessária.' });
    return;
  }
  next();
};

// Validação de Força da Senha
// VULN-06: Politica de senha reforçada — min 8 chars, 1 maiuscula, 1 minuscula, 1 numero
function isValidPassword(pass: string): boolean {
  if (!pass || typeof pass !== 'string') return false;
  if (pass.length < 8) return false;
  if (!/[A-Z]/.test(pass)) return false;
  if (!/[a-z]/.test(pass)) return false;
  if (!/[0-9]/.test(pass)) return false;
  return true;
}

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────────
const healthLimiter = rateLimit({ windowMs: 60000, max: 20, standardHeaders: true, legacyHeaders: false });
// VULN-10: Health check protegido por token secreto
app.get('/api/health', healthLimiter, (req: Request, res: Response) => {
  const HEALTH_TOKEN = process.env.HEALTH_TOKEN;
  if (HEALTH_TOKEN) {
    const provided = req.headers['x-health-token'];
    if (!provided || provided !== HEALTH_TOKEN) {
      res.status(403).json({ error: 'Acesso negado.' });
      return;
    }
  }
  res.json({ status: 'ok' });
});

// VULN-02: Endpoint de logout — revoga o token imediatamente
app.post('/api/auth/logout', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user?.jti) {
    revokedTokens.add(user.jti);
    // Limpar tokens expirados: o Set crescerá indefinidamente sem limpeza periódica
    // Em produção com alta escala, usar Redis com TTL
  }
  res.json({ message: 'Logout realizado com sucesso.' });
});

// ─── AUTO-MIGRAÇÃO COM STATEMENT TIMEOUT ───────────────────────────────────────
async function runMigrations() {
  const pg = require('pg');
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    statement_timeout: 5000,
    connectionTimeoutMillis: 5000,
  });
  try {
    await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'PJ';`);
    await pool.query(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'PJ';`);
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Company" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        document TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
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
    await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "companyId" TEXT;`);
    await pool.query(`ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;`);
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_status" ON "Transaction"(status);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_type" ON "Transaction"(type);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_context" ON "Transaction"(context);`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_dueDate" ON "Transaction"("dueDate");`).catch(() => {});
    await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_companyId" ON "Transaction"("companyId");`).catch(() => {});
    
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
    await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'FINANCE';`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "WarehouseCategory" (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#64748b',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.error('⚠️ Detalhes da migração:', e);
  } finally {
    await pool.end();
  }
}

// ─── AUTENTICAÇÃO E GESTÃO DE USUÁRIOS (PRISMA 100% PREPARED STATEMENTS) ──────

// Criar novo usuário (apenas ADMIN autenticado)
app.post('/api/auth/register', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { name, email, password, module: userModule } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    return;
  }
  if (!isValidPassword(password)) {
    res.status(400).json({ error: 'A senha deve conter no mínimo 8 caracteres.' });
    return;
  }
  const cleanEmail = String(email).toLowerCase().trim();
  const mod = ['FINANCE', 'WAREHOUSE', 'ADMIN'].includes(userModule) ? userModule : 'FINANCE';

  try {
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      res.status(409).json({ error: 'E-mail já cadastrado.' });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: 'USER',
        module: mod,
      },
      select: { id: true, name: true, email: true, role: true, module: true, createdAt: true },
    });
    res.status(201).json({ message: 'Usuário criado com sucesso.', id: newUser.id });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

// Login com proteção de força bruta
app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    // Sempre executa bcrypt mesmo se usuario nao existe � previne user enumeration por timing
    const dummyHash = '$2b$12$invalidhashfortimingnormalizationonlyxx';
    const valid = await bcrypt.compare(String(password), user ? user.password : dummyHash);
    if (!user || !valid) {
      res.status(401).json({ error: "E-mail ou senha incorretos." });
      return;
    }
    const moduleVal = (user as any).module;
    if (!moduleVal) {
      res.status(403).json({ error: 'Conta sem m�dulo de acesso definido. Contate o administrador.' });
      return;
    }
    const module = moduleVal;
    const jti = require('crypto').randomUUID();
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, module, role: user.role, jti },
      JWT_SECRET,
      { expiresIn: '2h', algorithm: 'HS256' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, module, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar autenticação.' });
  }
});

// Recuperação de Senha com PIN Seguro
app.post('/api/auth/reset', authLimiter, async (req: Request, res: Response) => {
  const { email, newPassword, pin } = req.body;
  if (!email || !newPassword || !pin) {
    res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    return;
  }

  if (!SECURITY_PIN) {
    res.status(403).json({ error: 'Redefinição de senha desabilitada por segurança (PIN não configurado no servidor).' });
    return;
  }

  if (!safeStringEqual(String(pin).trim(), String(SECURITY_PIN).trim())) {
    console.warn(`🚨 [SECURITY] Tentativa de redefinição com PIN inválido para email: ${email} de IP: ${req.ip}`);
    res.status(403).json({ error: 'PIN de Segurança inválido.' });
    return;
  }

  if (!isValidPassword(newPassword)) {
    res.status(400).json({ error: 'A nova senha deve ter no mínimo 8 caracteres.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user) {
      res.status(400).json({ error: 'Não foi possível redefinir a senha para os dados informados.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Senha alterada com sucesso! Você já pode fazer login.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
});

// Listar usuários (apenas ADMIN)
app.get('/api/auth/users', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, module: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

// Atualizar módulo do usuário (apenas ADMIN)
app.patch('/api/auth/users/:id/module', authMiddleware, adminMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { module } = req.body;
  if (!['FINANCE', 'WAREHOUSE', 'ADMIN'].includes(module)) {
    res.status(400).json({ error: 'Módulo inválido. Use FINANCE, WAREHOUSE ou ADMIN.' });
    return;
  }
  try {
    await prisma.user.update({
      where: { id },
      data: { module },
    });
    res.json({ message: 'Módulo atualizado com sucesso.' });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar módulo.' });
  }
});

// Trocar senha de usuário (apenas ADMIN)
app.patch('/api/auth/users/:id/password', authMiddleware, adminMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { newPassword } = req.body;
  if (!isValidPassword(newPassword)) {
    res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' });
    return;
  }
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
    res.json({ message: 'Senha atualizada com sucesso.' });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar senha.' });
  }
});

// Deletar usuário (apenas ADMIN — não pode deletar a si mesmo)
app.delete('/api/auth/users/:id', authMiddleware, adminMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const requesterId = (req as any).user?.id;
  if (id === requesterId) {
    res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
    return;
  }
  try {
    await prisma.user.delete({ where: { id: String(id) } });
    res.json({ message: 'Usuário excluído com sucesso.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
});

// ─── TRANSAÇÕES (FINANCEIRO) ───────────────────────────────────────────────────
app.get('/api/transactions', authMiddleware, financeMiddleware, async (_req: Request, res: Response) => {
  try {
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
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar transações.' });
  }
});

app.get('/api/transactions/:id/attachment', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const t = await prisma.transaction.findUnique({
      where: { id },
      select: { attachmentUrl: true },
    });
    if (!t || !t.attachmentUrl) return res.status(404).json({ error: 'Anexo não encontrado' });
    res.json({ attachmentUrl: t.attachmentUrl });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar anexo.' });
  }
});

app.post('/api/transactions', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { description, amount, type, status, dueDate, paymentDate, isRecurring, categoryId, entityId, companyId, attachmentUrl } = req.body;
  if (!description || amount == null || !dueDate) {
    res.status(400).json({ error: 'Descrição, valor e data de vencimento são obrigatórios.' });
    return;
  }
  try {
    const transaction = await prisma.transaction.create({
      data: {
        description: String(description).trim(),
        amount: sanitizeAmount(amount),
        type: type === 'IN' ? 'IN' : 'OUT',
        status: status || 'PENDING',
        dueDate: new Date(dueDate),
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        isRecurring: Boolean(isRecurring),
        categoryId: categoryId || null,
        entityId: entityId || null,
        companyId: companyId || null,
        attachmentUrl: (attachmentUrl && isSecureUrl(String(attachmentUrl))) ? String(attachmentUrl) : null,
        context: 'PJ',
      },
    });
    res.status(201).json(transaction);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar transação.' });
  }
});

app.patch('/api/transactions/:id/attach', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { attachmentUrl } = req.body;
  const safeUrl = (attachmentUrl && isSecureUrl(String(attachmentUrl))) ? String(attachmentUrl) : null;
  try {
    const t = await prisma.transaction.update({ where: { id }, data: { attachmentUrl: safeUrl } });
    res.json(t);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao anexar comprovante.' });
  }
});

app.patch('/api/transactions/:id/pay', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { paymentDate, bankAccountId, amount } = req.body;
  try {
    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const updateData: any = { status: 'PAID', paymentDate: payDate };
    if (bankAccountId) updateData.bankAccountId = bankAccountId;
    if (amount != null) updateData.amount = sanitizeAmount(amount);

    // Atomic check: verifica se j� foi paga antes de atualizar (previne race condition)
    const existing = await prisma.transaction.findUnique({ where: { id }, select: { status: true, isRecurring: true } });
    if (!existing) { res.status(404).json({ error: 'Transa��o n�o encontrada.' }); return; }
    if (existing.status === 'PAID') { res.status(409).json({ error: 'Esta transa��o j� foi baixada.' }); return; }

    const t = await prisma.transaction.update({ where: { id }, data: updateData });

    if (t.isRecurring) {
      const nextDueDate = new Date(t.dueDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      // Cria recorrente apenas se n�o existir uma com mesma desc+dueDate (previne duplicatas)
      const dupCheck = await prisma.transaction.findFirst({
        where: { description: t.description, dueDate: nextDueDate, status: 'PENDING', isRecurring: true },
      });
      if (!dupCheck) {
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
            context: t.context,
          },
        });
      }
    }

    res.json(t);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao dar baixa.' });
  }
});

app.delete('/api/transactions/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await prisma.transaction.delete({ where: { id: String(id) } });
    res.json({ message: 'Excluído.' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao excluir.' });
  }
});

// ─── LEITURA DE BOLETO (OCR SEGURO) ───────────────────────────────────────────
app.post('/api/ocr/boleto', authMiddleware, financeMiddleware, ocrLimiter, express.json({ limit: '10mb' }), async (req: Request, res: Response) => {
  const { fileBase64 } = req.body;
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    res.status(400).json({ error: 'Arquivo PDF não fornecido.' });
    return;
  }
  
  if (fileBase64.length > 8 * 1024 * 1024) {
    res.status(400).json({ error: 'Arquivo excede o limite máximo permitido.' });
    return;
  }

  try {
    const base64Data = fileBase64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Verificação de Magic Bytes para arquivo PDF (%PDF-)
    if (buffer.length < 5 || buffer.toString('utf8', 0, 5) !== '%PDF-') {
      res.status(400).json({ error: 'O arquivo enviado não é um PDF válido.' });
      return;
    }

    const data = await pdfParse(buffer);
    const text = data.text || '';
    
    const valueMatch = text.match(/R\$\s*([\d\.,]+)/) || text.match(/Valor[^\d]*([\d\.,]+)/i);
    let amount = '';
    if (valueMatch) {
      amount = valueMatch[1].replace(/\./g, '').replace(',', '.');
    }
    
    const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    let dueDate = '';
    if (dateMatch) {
      dueDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
    
    res.json({ amount, dueDate });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao processar o PDF do boleto.' });
  }
});

// ─── RESUMO / DASHBOARD ───────────────────────────────────────────────────────
app.get('/api/summary', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  try {
    // VULN-12: Validar companyId como UUID antes de usar na query
    const rawCompanyId = req.query.companyId;
    const companyId = rawCompanyId && rawCompanyId !== 'all' && UUID_V4_REGEX.test(String(rawCompanyId))
      ? String(rawCompanyId) : undefined;
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
    res.status(500).json({ error: 'Erro ao calcular resumo.' });
  }
});

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────
app.get('/api/categories', authMiddleware, financeMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await prisma.category.findMany());
  } catch {
    res.status(500).json({ error: 'Erro ao buscar categorias.' });
  }
});

app.post('/api/categories', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { name, type, color } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Nome é obrigatório.' });
    return;
  }
  try {
    res.status(201).json(await prisma.category.create({ data: { name: String(name).trim(), type: type === 'IN' ? 'IN' : 'OUT', color: color || null } }));
  } catch {
    res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
});

app.delete('/api/categories/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await prisma.category.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir categoria.' });
  }
});

// ─── ENTIDADES (FORNECEDORES / CLIENTES) ───────────────────────────────────────
app.get('/api/entities', authMiddleware, financeMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await prisma.entity.findMany());
  } catch {
    res.status(500).json({ error: 'Erro ao buscar entidades.' });
  }
});

app.post('/api/entities', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { name, document, type } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Nome é obrigatório.' });
    return;
  }
  try {
    res.status(201).json(await prisma.entity.create({ data: { name: String(name).trim(), document: document ? String(document).replace(/[^0-9a-zA-Z.\-\/]/g, '').slice(0, 20) : null, type: type || 'SUPPLIER' } }));
  } catch {
    res.status(500).json({ error: 'Erro ao criar entidade.' });
  }
});

app.delete('/api/entities/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await prisma.entity.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir entidade.' });
  }
});

// ─── EMPRESAS E CONTAS BANCÁRIAS ──────────────────────────────────────────────
app.get('/api/companies', authMiddleware, financeMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await (prisma as any).company.findMany());
  } catch {
    res.status(500).json({ error: 'Erro ao buscar empresas.' });
  }
});

app.post('/api/companies', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { name, document } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Nome da empresa é obrigatório.' });
    return;
  }
  try {
    res.status(201).json(await (prisma as any).company.create({ data: { name: String(name).trim(), document: document || null } }));
  } catch {
    res.status(500).json({ error: 'Erro ao criar empresa.' });
  }
});

app.delete('/api/companies/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).company.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir empresa.' });
  }
});

app.get('/api/bank-accounts', authMiddleware, financeMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await (prisma as any).bankAccount.findMany());
  } catch {
    res.status(500).json({ error: 'Erro ao buscar contas bancárias.' });
  }
});

app.post('/api/bank-accounts', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { name, agency, account } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Nome do banco é obrigatório.' });
    return;
  }
  try {
    res.status(201).json(await (prisma as any).bankAccount.create({ data: { name: String(name).trim(), agency: agency || null, account: account || null } }));
  } catch {
    res.status(500).json({ error: 'Erro ao criar conta bancária.' });
  }
});

app.delete('/api/bank-accounts/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).bankAccount.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir conta bancária.' });
  }
});

// ─── FINANÇAS PESSOAIS (PF) ────────────────────────────────────────────────────
app.get('/api/pf/categories', authMiddleware, financeMiddleware, async (_req: Request, res: Response) => {
  try {
    let cats = await (prisma as any).category.findMany({ where: { context: 'PF' } });
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
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar categorias PF.' });
  }
});

app.post('/api/pf/categories', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { name, type, color } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Nome é obrigatório.' });
    return;
  }
  try {
    const cat = await (prisma as any).category.create({ data: { name: String(name).trim(), type, color: color || '#94a3b8', context: 'PF' } });
    res.status(201).json(cat);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar categoria PF.' });
  }
});

app.delete('/api/pf/categories/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).category.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir categoria PF.' });
  }
});

app.get('/api/pf/transactions', authMiddleware, financeMiddleware, async (_req: Request, res: Response) => {
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
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar transações PF.' });
  }
});

app.post('/api/pf/transactions', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { description, amount, type, status, dueDate, paymentDate, isRecurring, categoryId, entityId, companyId, bankAccountId } = req.body;
  if (!description || amount == null || !dueDate) {
    res.status(400).json({ error: 'Descrição, valor e vencimento são obrigatórios.' });
    return;
  }
  try {
    const t = await (prisma as any).transaction.create({
      data: {
        description: String(description).trim(),
        amount: sanitizeAmount(amount),
        type: type === 'IN' ? 'IN' : 'OUT',
        status: status || 'PENDING',
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
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar transação PF.' });
  }
});

app.patch('/api/pf/transactions/:id/pay', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { paymentDate, bankAccountId, amount } = req.body;
  try {
    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const updateData: any = { status: 'PAID', paymentDate: payDate };
    if (bankAccountId) updateData.bankAccountId = bankAccountId;
    if (amount != null) updateData.amount = sanitizeAmount(amount);

    const t = await (prisma as any).transaction.update({
      where: { id }, data: updateData,
    });
    if (t.isRecurring) {
      const nextDue = new Date(t.dueDate);
      nextDue.setMonth(nextDue.getMonth() + 1);
      await (prisma as any).transaction.create({
        data: { description: t.description, amount: t.amount, type: t.type, categoryId: t.categoryId, entityId: t.entityId, companyId: t.companyId, dueDate: nextDue, status: 'PENDING', isRecurring: true, context: 'PF' },
      });
    }
    res.json(t);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao dar baixa.' });
  }
});

app.delete('/api/pf/transactions/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).transaction.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir.' });
  }
});

// Orçamentos (Budget)
app.get('/api/pf/budgets', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const now = new Date();
  const month = Math.min(12, Math.max(1, parseInt(req.query.month as string) || (now.getMonth() + 1)));
  const year = parseInt(req.query.year as string) || now.getFullYear();
  try {
    const budgets = await (prisma as any).budget.findMany({
      where: { context: 'PF', month, year },
      include: { category: true },
    });
    res.json(budgets);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar orçamentos.' });
  }
});

app.post('/api/pf/budgets', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { name, categoryId, limitAmount, month, year } = req.body;
  if (!name || limitAmount == null) {
    res.status(400).json({ error: 'Nome e limite de valor são obrigatórios.' });
    return;
  }
  try {
    const b = await (prisma as any).budget.create({
      data: {
        name: String(name).trim(),
        categoryId: categoryId || null,
        limitAmount: sanitizeAmount(limitAmount),
        month: Math.min(12, Math.max(1, Number(month) || 1)),
        year: Math.min(2100, Math.max(2000, Number(year) || new Date().getFullYear())),
        context: 'PF',
      },
      include: { category: true },
    });
    res.status(201).json(b);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar orçamento.' });
  }
});

app.delete('/api/pf/budgets/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).budget.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir.' });
  }
});

// Metas (Goals)
app.get('/api/pf/goals', authMiddleware, financeMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await (prisma as any).goal.findMany({ where: { context: 'PF' }, orderBy: { createdAt: 'asc' } }));
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar metas.' });
  }
});

app.post('/api/pf/goals', authMiddleware, financeMiddleware, async (req: Request, res: Response) => {
  const { name, emoji, targetAmount, deadline } = req.body;
  if (!name || targetAmount == null) {
    res.status(400).json({ error: 'Nome e valor alvo são obrigatórios.' });
    return;
  }
  try {
    const g = await (prisma as any).goal.create({
      data: {
        name: String(name).trim(),
        emoji: emoji || '🎯',
        targetAmount: sanitizeAmount(targetAmount),
        deadline: deadline ? new Date(deadline) : null,
        context: 'PF',
      },
    });
    res.status(201).json(g);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar meta.' });
  }
});

app.patch('/api/pf/goals/:id/deposit', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { amount } = req.body;
  try {
    const g = await (prisma as any).goal.findUnique({ where: { id: String(id) } });
    if (!g) { res.status(404).json({ error: 'Meta não encontrada.' }); return; }
    const updated = await (prisma as any).goal.update({
      where: { id },
      data: { currentAmount: Math.min(g.currentAmount + Math.abs(Number(amount) || 0), g.targetAmount) },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao depositar.' });
  }
});

app.delete('/api/pf/goals/:id', authMiddleware, financeMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await (prisma as any).goal.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir meta.' });
  }
});

// ─── ALMOXARIFADO (WAREHOUSE - PROTEGIDO COM RBAC) ─────────────────────────────

// Categorias do Almoxarifado
app.get('/api/warehouse/categories', authMiddleware, warehouseMiddleware, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.warehouseCategory.findMany({ orderBy: { name: 'asc' } });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar categorias.' });
  }
});

app.post('/api/warehouse/categories', authMiddleware, warehouseMiddleware, async (req: Request, res: Response) => {
  const { name, color } = req.body;
  if (!name) { res.status(400).json({ error: 'Nome da categoria é obrigatório.' }); return; }
  try {
    const row = await prisma.warehouseCategory.create({
      data: { name: String(name).trim(), color: color || '#64748b' },
    });
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
});

app.delete('/api/warehouse/categories/:id', authMiddleware, warehouseMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await prisma.warehouseCategory.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao excluir categoria.' });
  }
});

// Fornecedores de Estoque
app.get('/api/warehouse/suppliers', authMiddleware, warehouseMiddleware, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.stockSupplier.findMany({ orderBy: { name: 'asc' } });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar fornecedores.' });
  }
});

app.post('/api/warehouse/suppliers', authMiddleware, warehouseMiddleware, async (req: Request, res: Response) => {
  const { name, document, contact, email, phone } = req.body;
  if (!name) { res.status(400).json({ error: 'Nome do fornecedor é obrigatório.' }); return; }
  try {
    const row = await prisma.stockSupplier.create({
      data: {
        name: String(name).trim(),
        document: document ? String(document).replace(/[^0-9.\-\/]/g, '').slice(0, 20) : null,
        contact: contact ? String(contact).slice(0, 100) : null,
        email: email || null,
        phone: phone || null,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar fornecedor.' });
  }
});

app.delete('/api/warehouse/suppliers/:id', authMiddleware, warehouseMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await prisma.stockSupplier.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao excluir fornecedor.' });
  }
});

// Localizações
app.get('/api/warehouse/locations', authMiddleware, warehouseMiddleware, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.stockLocation.findMany({ orderBy: { label: 'asc' } });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar localizações.' });
  }
});

app.post('/api/warehouse/locations', authMiddleware, warehouseMiddleware, async (req: Request, res: Response) => {
  const { aisle, shelf, position } = req.body;
  if (!aisle || !shelf || !position) {
    res.status(400).json({ error: 'Corredor, prateleira e posição são obrigatórios.' });
    return;
  }
  try {
    const label = `${String(aisle).toUpperCase()}-${String(shelf).padStart(2,'0')}-${String(position).padStart(2,'0')}`;
    const row = await prisma.stockLocation.create({
      data: { aisle: String(aisle).trim(), shelf: String(shelf).trim(), position: String(position).trim(), label },
    });
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao criar localização.' });
  }
});

app.delete('/api/warehouse/locations/:id', authMiddleware, warehouseMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    await prisma.stockLocation.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'Excluído.' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao excluir localização.' });
  }
});

// Produtos
app.get('/api/warehouse/products', authMiddleware, warehouseMiddleware, async (req: Request, res: Response) => {
  try {
    const pageNum = Math.max(1, parseInt(req.query.page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const search = req.query.search ? String(req.query.search).trim().slice(0, 100) : undefined;
    const category = req.query.category ? String(req.query.category).trim() : undefined;

    let where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { manufacturerCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;

    const skip = (pageNum - 1) * limitNum;
    
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { location: true, supplier: true },
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
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
        supplierDocument: supplier?.document,
      };
    });
    
    res.json({
      data: result,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
});

app.get('/api/warehouse/products-search', authMiddleware, warehouseMiddleware, async (req: Request, res: Response) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : undefined;
    let where: any = { active: true };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }
    const products = await prisma.product.findMany({
      where,
      select: { id: true, name: true, code: true, currentStock: true, unit: true, costPrice: true, location: { select: { label: true } } },
      take: 50,
      orderBy: { name: 'asc' },
    });
    res.json(products.map((p: any) => ({ ...p, locationLabel: p.location?.label })));
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
});

app.get('/api/warehouse/products/:id', authMiddleware, warehouseMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const p: any = await prisma.product.findUnique({
      where: { id: String(req.params.id) },
      include: { location: true, supplier: true },
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
      supplierDocument: supplier?.document,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar produto.' });
  }
});

app.get('/api/warehouse/products/:id/image', authMiddleware, warehouseMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  try {
    const p = await prisma.product.findUnique({ where: { id: String(req.params.id) }, select: { imageUrl: true } });
    if (!p || !p.imageUrl) return res.status(404).json({ error: 'Imagem não encontrada.' });
    res.json({ imageUrl: p.imageUrl });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar imagem.' });
  }
});

app.post('/api/warehouse/products', authMiddleware, warehouseMiddleware, async (req: Request, res: Response) => {
  const { name, description, code, manufacturerCode, imageUrl, unit, category, minStock, costPrice, salePrice, locationId, supplierId } = req.body;
  if (!name || !code) {
    res.status(400).json({ error: 'Nome e código são obrigatórios.' });
    return;
  }
  try {
    const product = await prisma.product.create({
      data: {
        name: String(name).trim(),
        description: description || null,
        code: String(code).trim(),
        manufacturerCode: manufacturerCode || null,
        imageUrl: (imageUrl && isSecureUrl(String(imageUrl))) ? String(imageUrl) : null,
        unit: unit || 'UN',
        category: category || 'Geral',
        minStock: Math.max(0, Number(minStock) || 0),
        costPrice: Math.max(0, Number(costPrice) || 0),
        salePrice: Math.max(0, Number(salePrice) || 0),
        locationId: locationId || null,
        supplierId: supplierId || null,
        currentStock: 0,
        active: true,
      },
    });
    res.status(201).json(product);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Código já existe. Use um código único.' });
    res.status(500).json({ error: 'Erro ao criar produto.' });
  }
});

app.patch('/api/warehouse/products/:id', authMiddleware, warehouseMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { name, description, code, manufacturerCode, unit, category, minStock, costPrice, salePrice, locationId, supplierId, active } = req.body;
  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name ? String(name).trim() : undefined,
        description: description !== undefined ? description : undefined,
        code: code ? String(code).trim() : undefined,
        manufacturerCode: manufacturerCode !== undefined ? manufacturerCode : undefined,
        unit: unit || undefined,
        category: category || undefined,
        minStock: minStock != null ? Math.max(0, Number(minStock)) : undefined,
        costPrice: costPrice != null ? Math.max(0, Number(costPrice)) : undefined,
        salePrice: salePrice != null ? Math.max(0, Number(salePrice)) : undefined,
        locationId: locationId !== undefined ? (locationId || null) : undefined,
        supplierId: supplierId !== undefined ? (supplierId || null) : undefined,
        active: active != null ? Boolean(active) : undefined,
      },
    });
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
});

app.patch('/api/warehouse/products/:id/image', authMiddleware, warehouseMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const { imageUrl } = req.body;
  const safeImg = (imageUrl && isSecureUrl(String(imageUrl))) ? String(imageUrl) : null;
  try {
    await prisma.product.update({ where: { id: String(req.params.id) }, data: { imageUrl: safeImg } });
    res.json({ message: 'Imagem atualizada com sucesso.' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao atualizar imagem.' });
  }
});

app.delete('/api/warehouse/products/:id', authMiddleware, warehouseMiddleware, validateUuidParam('id'), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await prisma.stockMovement.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id: String(id) } });
    res.json({ message: 'Produto e histórico excluídos com sucesso.' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao excluir produto.' });
  }
});

// Movimentações de Estoque
app.get('/api/warehouse/movements', authMiddleware, warehouseMiddleware, async (req: Request, res: Response) => {
  try {
    const { productId, type, from, to, page = '1', limit = '50', fetchTypes } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    
    let where: any = {};
    if (productId) where.productId = String(productId);
    if (type) where.type = String(type);
    if (fetchTypes) {
      const VALID_FETCH_TYPES = ['ENTRY', 'EXIT', 'RETURN', 'SALE', 'ADJUSTMENT', 'LOSS'];
      const requestedTypes = String(fetchTypes).split(',').filter(t => VALID_FETCH_TYPES.includes(t.trim()));
      if (requestedTypes.length > 0) where.type = { in: requestedTypes };
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
    
    const skip = (pageNum - 1) * limitNum;

    const [movs, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
        include: { product: true },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    
    const result = movs.map((m: any) => {
      const { product, ...rest } = m;
      return {
        ...rest,
        productName: product?.name,
        productCode: product?.code,
        productUnit: product?.unit,
      };
    });
    res.json({
      data: result,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar movimentações.' });
  }
});

app.post('/api/warehouse/movements', authMiddleware, warehouseMiddleware, async (req: Request, res: Response) => {
  const { productId, type, quantity, unitPrice, reason, document, date } = req.body;
  const user = (req as any).user;
  if (!productId || !type || quantity == null) {
    res.status(400).json({ error: 'Produto, tipo e quantidade são obrigatórios.' });
    return;
  }
    const VALID_MOVEMENT_TYPES = ['ENTRY', 'EXIT', 'RETURN', 'SALE', 'ADJUSTMENT', 'LOSS'];
  // VULN-03: Rejeitar tipos de movimentacao nao permitidos
  if (!VALID_MOVEMENT_TYPES.includes(String(type))) {
    res.status(400).json({ error: 'Tipo de movimentacao invalido.' });
    return;
  }
  try {
    const prod = await prisma.product.findUnique({ where: { id: productId } });
    if (!prod) return res.status(404).json({ error: 'Produto não encontrado.' });
    
    const qty = Math.abs(Number(quantity));
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
          createdBy: user?.name || null,
        },
      }),
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      }),
    ]);
    
    res.json({ ...movement, newStock });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao registrar movimentação.' });
  }
});

// Dashboard e Resumo Almoxarifado
app.get('/api/warehouse/summary', authMiddleware, warehouseMiddleware, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const activeProducts = await prisma.product.findMany({ where: { active: true }, take: 500, select: { currentStock: true, costPrice: true, minStock: true } });
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
      where: { active: true, minStock: { gt: 0 } },
      include: { location: true },
      take: 200,
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
      _sum: { totalPrice: true },
    });
    
    const movementsByType = movements.map(m => ({
      type: m.type,
      count: m._count._all,
      total: m._sum.totalPrice || 0,
    }));
    
    res.json({
      totalProducts,
      totalValue,
      totalItems,
      lowStockCount,
      lowStockItems: filteredLowStock,
      movementsByType,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar resumo do estoque.' });
  }
});

app.get('/api/warehouse/low-stock', authMiddleware, warehouseMiddleware, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.product.findMany({
      where: {
        active: true,
        minStock: { gt: 0 },
      },
      include: { location: true, supplier: true },
    });
    
    const result = items
      .filter((p: any) => p.currentStock <= p.minStock)
      .sort((a: any, b: any) => (a.currentStock / a.minStock) - (b.currentStock / b.minStock))
      .map((p: any) => {
        const { location, supplier, ...rest } = p;
        return {
          ...rest,
          locationLabel: location?.label,
          supplierName: supplier?.name,
        };
      });
      
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar produtos com estoque baixo.' });
  }
});

// ─── TRATAMENTO GLOBAL DE ERROS SEGURO (SEM VAZAMENTO DE STACK TRACE) ─────────
// Handler 404 para rotas inexistentes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Rota nao encontrada.' });
});

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`⚠️ [ERRO SERVIDOR] ${req.method} ${req.originalUrl}:`, err.message || err);
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Payload JSON mal formatado ou inválido.' });
    return;
  }
  if (err.message && err.message.includes('CORS')) {
    res.status(403).json({ error: 'Acesso bloqueado pela política de CORS.' });
    return;
  }
  res.status(err.status || 500).json({ error: 'Erro interno ao processar a solicitação.' });
});

// ─── INICIALIZAÇÃO DO SERVIDOR COM PROTEÇÃO SLOWLORIS ─────────────────────────
const server = app.listen(port, () => {
  console.log(`🚀 Servidor Magalhães seguro e operacional na porta ${port}`);
  runMigrations();
});

// Timeouts defensivos contra ataques Slowloris e conexões zumbis
server.headersTimeout = 20000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 65000;
