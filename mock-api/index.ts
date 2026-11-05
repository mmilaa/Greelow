import express, { Request, Response, NextFunction } from "express";
import Database from "better-sqlite3";
import cors from "cors";

const app = express();
const db = new Database("data.db");

app.use(cors());
app.use(express.json());

// =============================================================================
// AUTH MOCK
// =============================================================================

const FAKE_TOKEN_PREFIX = "fake-token-";

function generateToken(userId: string): string {
  return `${FAKE_TOKEN_PREFIX}${userId}`;
}

function extractUserId(token: string): string | null {
  if (token.startsWith(FAKE_TOKEN_PREFIX)) {
    return token.replace(FAKE_TOKEN_PREFIX, "");
  }
  return null;
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");
  const userId = extractUserId(token);

  if (!userId) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const user = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(userId);

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  (req as any).user = user;
  next();
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

interface ValidationError {
  field: string;
  message: string;
}

function validateString(
  value: any,
  field: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationError | null {
  const { required = true, minLength = 1, maxLength = 500 } = options;

  if (value === undefined || value === null || value === "") {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  if (typeof value !== "string") {
    return { field, message: `${field} must be a string` };
  }

  if (value.length < minLength) {
    return { field, message: `${field} must be at least ${minLength} characters` };
  }

  if (value.length > maxLength) {
    return { field, message: `${field} must be at most ${maxLength} characters` };
  }

  return null;
}

function validateNumber(
  value: any,
  field: string,
  options: { required?: boolean; min?: number; max?: number } = {}
): ValidationError | null {
  const { required = true, min, max } = options;

  if (value === undefined || value === null || value === "") {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  if (typeof value !== "number" || isNaN(value)) {
    return { field, message: `${field} must be a number` };
  }

  if (min !== undefined && value < min) {
    return { field, message: `${field} must be at least ${min}` };
  }

  if (max !== undefined && value > max) {
    return { field, message: `${field} must be at most ${max}` };
  }

  return null;
}

function validateEnum(
  value: any,
  field: string,
  allowed: string[],
  options: { required?: boolean } = {}
): ValidationError | null {
  const { required = true } = options;

  if (value === undefined || value === null || value === "") {
    if (required) {
      return { field, message: `${field} is required` };
    }
    return null;
  }

  if (!allowed.includes(value)) {
    return { field, message: `${field} must be one of: ${allowed.join(", ")}` };
  }

  return null;
}

function validateEmail(value: any, field: string): ValidationError | null {
  const stringError = validateString(value, field, { maxLength: 255 });
  if (stringError) return stringError;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { field, message: `${field} must be a valid email address` };
  }

  return null;
}

function collectErrors(errors: (ValidationError | null)[]): ValidationError[] {
  return errors.filter((e): e is ValidationError => e !== null);
}

// =============================================================================
// DOMAIN HELPERS
// =============================================================================

const ALLOWED_CURRENCIES = ["ARS", "USD", "EUR"];
const ALLOWED_CATEGORIES = [
  "salary",
  "freelance",
  "rent",
  "groceries",
  "transport",
  "entertainment",
  "utilities",
  "health",
  "transfer",
  "other",
];

// Transferencias: quedan "pending" al crearse y liquidan solas luego de este
// delay, simulando un proceso async real (ej: validación antifraude).
const TRANSFER_SETTLEMENT_DELAY_MS = 1500;

function computeBalance(accountId: string): number {
  const row = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(
          CASE
            WHEN type = 'income' THEN amount
            WHEN type = 'expense' THEN -amount
            WHEN type = 'transfer' AND direction = 'in' THEN amount
            WHEN type = 'transfer' AND direction = 'out' THEN -amount
            ELSE 0
          END
        ), 0) as balance
      FROM transactions
      WHERE accountId = ? AND status = 'completed'
    `
    )
    .get(accountId) as any;

  return Math.round(row.balance * 100) / 100;
}

function getOwnAccount(accountId: string, userId: string) {
  return db.prepare("SELECT * FROM accounts WHERE id = ? AND userId = ?").get(accountId, userId) as any;
}

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

app.post("/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;

  const errors = collectErrors([
    validateEmail(email, "email"),
    validateString(password, "password", { minLength: 1 }),
  ]);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const user = db
    .prepare("SELECT id, email, name, password FROM users WHERE email = ?")
    .get(email) as any;

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = generateToken(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
});

app.get("/auth/me", authMiddleware, (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

// =============================================================================
// ACCOUNTS ENDPOINTS
// =============================================================================

app.get("/accounts", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;

  const accounts = db
    .prepare("SELECT * FROM accounts WHERE userId = ? ORDER BY createdAt ASC")
    .all(user.id) as any[];

  const withBalance = accounts.map((account) => ({
    ...account,
    balance: computeBalance(account.id),
  }));

  res.json({ accounts: withBalance });
});

app.get("/accounts/:id", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const account = getOwnAccount(req.params.id, user.id);

  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  res.json({ account: { ...account, balance: computeBalance(account.id) } });
});

app.post("/accounts", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, currency } = req.body;

  const errors = collectErrors([
    validateString(name, "name", { minLength: 2, maxLength: 100 }),
    validateEnum(currency, "currency", ALLOWED_CURRENCIES),
  ]);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const id = `acc-${Date.now()}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO accounts (id, userId, name, currency, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, user.id, name, currency, createdAt);

  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
  res.status(201).json({ account: { ...account, balance: 0 } });
});

// Nota: la moneda de una cuenta no se puede modificar luego de creada.
// Si el body incluye "currency", se ignora silenciosamente.
app.put("/accounts/:id", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name } = req.body;

  const existing = getOwnAccount(req.params.id, user.id);

  if (!existing) {
    return res.status(404).json({ error: "Account not found" });
  }

  const errors = collectErrors([validateString(name, "name", { minLength: 2, maxLength: 100 })]);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  db.prepare("UPDATE accounts SET name = ? WHERE id = ?").run(name, req.params.id);

  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id);
  res.json({ account: { ...account, balance: computeBalance(req.params.id) } });
});

// =============================================================================
// TRANSACTIONS ENDPOINTS
// =============================================================================

app.get("/transactions", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { accountId, type, category, status, search } = req.query;

  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 10, 1), 50);

  if (accountId && !getOwnAccount(accountId as string, user.id)) {
    return res.status(404).json({ error: "Account not found" });
  }

  let where = "WHERE accountId IN (SELECT id FROM accounts WHERE userId = ?)";
  const params: any[] = [user.id];

  if (accountId) {
    where += " AND accountId = ?";
    params.push(accountId);
  }
  if (type) {
    where += " AND type = ?";
    params.push(type);
  }
  if (category) {
    where += " AND category = ?";
    params.push(category);
  }
  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (search && typeof search === "string") {
    where += " AND description LIKE ?";
    params.push(`%${search}%`);
  }

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM transactions ${where}`).get(...params) as any
  ).count;

  const transactions = db
    .prepare(
      `
      SELECT * FROM transactions ${where}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json({ transactions, pagination: { page, pageSize, total } });
});

app.get("/transactions/:id", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;

  const transaction = db
    .prepare(
      `
      SELECT t.* FROM transactions t
      JOIN accounts a ON a.id = t.accountId
      WHERE t.id = ? AND a.userId = ?
    `
    )
    .get(req.params.id, user.id);

  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  res.json({ transaction });
});

app.post("/transactions", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { accountId, type, amount, category, description } = req.body;

  const errors = collectErrors([
    validateString(accountId, "accountId", { minLength: 1 }),
    validateEnum(type, "type", ["income", "expense"]),
    validateNumber(amount, "amount", { min: 0.01 }),
    validateEnum(category, "category", ALLOWED_CATEGORIES, { required: false }),
    validateString(description, "description", { required: false, maxLength: 500 }),
  ]);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const account = getOwnAccount(accountId, user.id);

  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  const id = `txn-${Date.now()}`;
  const createdAt = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO transactions
      (id, accountId, type, direction, amount, currency, category, description, status, counterpartAccountId, transferId, createdAt)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'completed', NULL, NULL, ?)
  `
  ).run(id, accountId, type, amount, account.currency, category || "other", description || "", createdAt);

  const transaction = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
  res.status(201).json({ transaction });
});

// Solo se pueden editar los metadatos (categoria/descripcion) de ingresos y
// gastos. El monto de un movimiento es inmutable una vez creado, y las
// transferencias no se pueden editar.
app.patch("/transactions/:id", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { category, description } = req.body;

  const transaction = db
    .prepare(
      `
      SELECT t.* FROM transactions t
      JOIN accounts a ON a.id = t.accountId
      WHERE t.id = ? AND a.userId = ?
    `
    )
    .get(req.params.id, user.id) as any;

  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  if (transaction.type === "transfer") {
    return res.status(400).json({ error: "Transfers cannot be edited" });
  }

  const errors = collectErrors([
    validateEnum(category, "category", ALLOWED_CATEGORIES, { required: false }),
    validateString(description, "description", { required: false, maxLength: 500 }),
  ]);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  db.prepare("UPDATE transactions SET category = ?, description = ? WHERE id = ?").run(
    category || transaction.category,
    description !== undefined ? description : transaction.description,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
  res.json({ transaction: updated });
});

// =============================================================================
// TRANSFERS ENDPOINTS
// =============================================================================

// Nota importante: si las cuentas de origen y destino tienen monedas
// distintas, la API NO hace ninguna conversion. El monto se registra tal
// cual en ambos lados, cada uno con la moneda de su propia cuenta. Que
// hacer con eso (bloquear, advertir, convertir en el front) es una decision
// de producto que la consigna deja abierta a proposito.
app.post("/transfers", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { fromAccountId, toAccountId, amount, description } = req.body;

  const errors = collectErrors([
    validateString(fromAccountId, "fromAccountId", { minLength: 1 }),
    validateString(toAccountId, "toAccountId", { minLength: 1 }),
    validateNumber(amount, "amount", { min: 0.01 }),
    validateString(description, "description", { required: false, maxLength: 500 }),
  ]);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: "Cannot transfer to the same account" });
  }

  const fromAccount = getOwnAccount(fromAccountId, user.id);

  if (!fromAccount) {
    return res.status(404).json({ error: "Source account not found" });
  }

  const toAccount = db.prepare("SELECT * FROM accounts WHERE id = ?").get(toAccountId) as any;

  if (!toAccount) {
    return res.status(404).json({ error: "Destination account not found" });
  }

  const balance = computeBalance(fromAccountId);

  if (amount > balance) {
    return res.status(422).json({ error: "Insufficient funds in source account" });
  }

  const transferId = `transfer-${Date.now()}`;
  const outId = `${transferId}-out`;
  const inId = `${transferId}-in`;
  const createdAt = new Date().toISOString();

  const insert = db.prepare(
    `
    INSERT INTO transactions
      (id, accountId, type, direction, amount, currency, category, description, status, counterpartAccountId, transferId, createdAt)
    VALUES (?, ?, 'transfer', ?, ?, ?, 'transfer', ?, 'pending', ?, ?, ?)
  `
  );

  insert.run(outId, fromAccountId, "out", amount, fromAccount.currency, description || "", toAccountId, transferId, createdAt);
  insert.run(inId, toAccountId, "in", amount, toAccount.currency, description || "", fromAccountId, transferId, createdAt);

  // Liquidacion asincronica: el estado pasa de "pending" a "completed" solo.
  // Nadie llama a este endpoint de nuevo para que eso pase.
  setTimeout(() => {
    db.prepare("UPDATE transactions SET status = 'completed' WHERE transferId = ?").run(transferId);
  }, TRANSFER_SETTLEMENT_DELAY_MS);

  const outTxn = db.prepare("SELECT * FROM transactions WHERE id = ?").get(outId);
  const inTxn = db.prepare("SELECT * FROM transactions WHERE id = ?").get(inId);

  res.status(201).json({ transfer: { id: transferId, status: "pending", from: outTxn, to: inTxn } });
});

app.get("/transfers/:transferId", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;

  const rows = db
    .prepare(
      `
      SELECT t.* FROM transactions t
      JOIN accounts a ON a.id = t.accountId
      WHERE t.transferId = ? AND a.userId = ?
    `
    )
    .all(req.params.transferId, user.id) as any[];

  if (rows.length === 0) {
    return res.status(404).json({ error: "Transfer not found" });
  }

  const from = rows.find((r) => r.direction === "out") || null;
  const to = rows.find((r) => r.direction === "in") || null;

  res.json({ transfer: { id: req.params.transferId, status: rows[0].status, from, to } });
});

// =============================================================================
// CATEGORIES ENDPOINT
// =============================================================================

app.get("/categories", authMiddleware, (_req: Request, res: Response) => {
  res.json({ categories: ALLOWED_CATEGORIES });
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Mock API fintech running at http://localhost:${PORT}`);
});
