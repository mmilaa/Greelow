import Database from "better-sqlite3";

const db = new Database("data.db");

// =============================================================================
// CREATE TABLES
// =============================================================================

console.log("Creating tables...");

db.exec(`
  DROP TABLE IF EXISTS transactions;
  DROP TABLE IF EXISTS accounts;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    direction TEXT CHECK (direction IN ('in', 'out')),
    amount REAL NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL,
    category TEXT,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    counterpartAccountId TEXT,
    transferId TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (accountId) REFERENCES accounts(id)
  );

  CREATE INDEX idx_accounts_userId ON accounts(userId);
  CREATE INDEX idx_transactions_accountId ON transactions(accountId);
  CREATE INDEX idx_transactions_transferId ON transactions(transferId);
`);

console.log("Tables created.");

// =============================================================================
// SEED DATA
// =============================================================================

console.log("Seeding data...");

// Users
const users = [
  { id: "user-1", email: "demo@example.com", name: "Usuario Demo", password: "demo123" },
  { id: "user-2", email: "test@example.com", name: "Test User", password: "test123" },
  { id: "user-3", email: "ana@example.com", name: "Ana Perez", password: "ana123" },
];

const insertUser = db.prepare(`
  INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)
`);

for (const user of users) {
  insertUser.run(user.id, user.email, user.name, user.password);
}

console.log(`Inserted ${users.length} users.`);

// Accounts
const accounts = [
  { id: "acc-1", userId: "user-1", name: "Cuenta Pesos", currency: "ARS", createdAt: "2026-08-01T09:00:00Z" },
  { id: "acc-2", userId: "user-1", name: "Cuenta Dolares", currency: "USD", createdAt: "2026-08-01T09:00:00Z" },
  { id: "acc-3", userId: "user-2", name: "Cuenta Principal", currency: "ARS", createdAt: "2026-08-01T09:00:00Z" },
  { id: "acc-4", userId: "user-3", name: "Cuenta de Ana", currency: "ARS", createdAt: "2026-08-01T09:00:00Z" },
];

const insertAccount = db.prepare(`
  INSERT INTO accounts (id, userId, name, currency, createdAt) VALUES (?, ?, ?, ?, ?)
`);

for (const account of accounts) {
  insertAccount.run(account.id, account.userId, account.name, account.currency, account.createdAt);
}

console.log(`Inserted ${accounts.length} accounts.`);

// Transactions (income/expense, siempre "completed")
const transactions = [
  // acc-1 (Usuario Demo, ARS)
  { id: "txn-1", accountId: "acc-1", type: "income", amount: 850000, category: "salary", description: "Sueldo septiembre", createdAt: "2026-09-01T09:00:00Z" },
  { id: "txn-2", accountId: "acc-1", type: "expense", amount: 320000, category: "rent", description: "Alquiler septiembre", createdAt: "2026-09-05T10:00:00Z" },
  { id: "txn-3", accountId: "acc-1", type: "expense", amount: 45000, category: "groceries", description: "Supermercado", createdAt: "2026-09-10T18:00:00Z" },
  { id: "txn-4", accountId: "acc-1", type: "expense", amount: 18000, category: "transport", description: "Subte y colectivo", createdAt: "2026-09-12T08:00:00Z" },
  { id: "txn-5", accountId: "acc-1", type: "expense", amount: 25000, category: "entertainment", description: "Cine", createdAt: "2026-09-15T21:00:00Z" },
  { id: "txn-6", accountId: "acc-1", type: "income", amount: 850000, category: "salary", description: "Sueldo octubre", createdAt: "2026-10-01T09:00:00Z" },
  { id: "txn-7", accountId: "acc-1", type: "expense", amount: 320000, category: "rent", description: "Alquiler octubre", createdAt: "2026-10-05T10:00:00Z" },
  { id: "txn-8", accountId: "acc-1", type: "expense", amount: 52000, category: "groceries", description: "Supermercado", createdAt: "2026-10-11T18:00:00Z" },
  { id: "txn-9", accountId: "acc-1", type: "expense", amount: 30000, category: "utilities", description: "Luz y gas", createdAt: "2026-10-14T12:00:00Z" },
  { id: "txn-10", accountId: "acc-1", type: "expense", amount: 15000, category: "health", description: "Farmacia", createdAt: "2026-10-20T16:00:00Z" },

  // acc-2 (Usuario Demo, USD)
  { id: "txn-11", accountId: "acc-2", type: "income", amount: 500, category: "freelance", description: "Proyecto freelance", createdAt: "2026-09-20T09:00:00Z" },
  { id: "txn-12", accountId: "acc-2", type: "expense", amount: 60, category: "entertainment", description: "Suscripciones", createdAt: "2026-10-02T09:00:00Z" },

  // acc-3 (Test User, ARS)
  { id: "txn-13", accountId: "acc-3", type: "income", amount: 600000, category: "salary", description: "Sueldo septiembre", createdAt: "2026-09-01T09:00:00Z" },
  { id: "txn-14", accountId: "acc-3", type: "expense", amount: 250000, category: "rent", description: "Alquiler septiembre", createdAt: "2026-09-05T10:00:00Z" },
  { id: "txn-15", accountId: "acc-3", type: "expense", amount: 38000, category: "groceries", description: "Supermercado", createdAt: "2026-09-18T18:00:00Z" },
  { id: "txn-16", accountId: "acc-3", type: "income", amount: 600000, category: "salary", description: "Sueldo octubre", createdAt: "2026-10-01T09:00:00Z" },
  { id: "txn-17", accountId: "acc-3", type: "expense", amount: 41000, category: "groceries", description: "Supermercado", createdAt: "2026-10-16T18:00:00Z" },

  // acc-4 (Ana, ARS)
  { id: "txn-18", accountId: "acc-4", type: "income", amount: 700000, category: "salary", description: "Sueldo septiembre", createdAt: "2026-09-01T09:00:00Z" },
];

const accountCurrency: Record<string, string> = {};
for (const account of accounts) {
  accountCurrency[account.id] = account.currency;
}

const insertTransaction = db.prepare(`
  INSERT INTO transactions
    (id, accountId, type, direction, amount, currency, category, description, status, counterpartAccountId, transferId, createdAt)
  VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'completed', NULL, NULL, ?)
`);

for (const t of transactions) {
  insertTransaction.run(
    t.id,
    t.accountId,
    t.type,
    t.amount,
    accountCurrency[t.accountId],
    t.category,
    t.description,
    t.createdAt
  );
}

console.log(`Inserted ${transactions.length} transactions.`);

// Una transferencia ya liquidada (completed) de acc-1 (Usuario Demo) a
// acc-4 (Ana), para que GET /transfers/:id tenga un ejemplo real desde el
// primer arranque.
const seedTransferId = "transfer-seed-1";

db.prepare(`
  INSERT INTO transactions
    (id, accountId, type, direction, amount, currency, category, description, status, counterpartAccountId, transferId, createdAt)
  VALUES (?, ?, 'transfer', 'out', ?, ?, 'transfer', ?, 'completed', ?, ?, ?)
`).run(`${seedTransferId}-out`, "acc-1", 20000, "ARS", "Pago compartido", "acc-4", seedTransferId, "2026-10-25T15:00:00Z");

db.prepare(`
  INSERT INTO transactions
    (id, accountId, type, direction, amount, currency, category, description, status, counterpartAccountId, transferId, createdAt)
  VALUES (?, ?, 'transfer', 'in', ?, ?, 'transfer', ?, 'completed', ?, ?, ?)
`).run(`${seedTransferId}-in`, "acc-4", 20000, "ARS", "Pago compartido", "acc-1", seedTransferId, "2026-10-25T15:00:00Z");

console.log("Inserted 1 seed transfer (2 linked rows).");

// =============================================================================
// DONE
// =============================================================================

console.log("\nSeed completed successfully!");
console.log("\nTest credentials:");
console.log("  demo@example.com / demo123  (acc-1 ARS, acc-2 USD)");
console.log("  test@example.com / test123  (acc-3 ARS)");
console.log("  ana@example.com  / ana123   (acc-4 ARS)");
