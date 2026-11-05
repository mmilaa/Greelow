const BASE_URL = "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(
  method: string,
  path: string,
  options: { body?: any; token?: string } = {}
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

// =============================================================================
// TESTS
// =============================================================================

async function runTests() {
  let demoToken = "";
  let anaToken = "";

  // ---------------------------------------------------------------------------
  // AUTH
  // ---------------------------------------------------------------------------

  await test("login fails with wrong password", async () => {
    const { status } = await api("POST", "/auth/login", {
      body: { email: "demo@example.com", password: "wrong" },
    });
    assertEqual(status, 401, "status");
  });

  await test("login fails with invalid email format", async () => {
    const { status } = await api("POST", "/auth/login", {
      body: { email: "not-an-email", password: "demo123" },
    });
    assertEqual(status, 400, "status");
  });

  await test("login succeeds with valid credentials", async () => {
    const { status, data } = await api("POST", "/auth/login", {
      body: { email: "demo@example.com", password: "demo123" },
    });
    assertEqual(status, 200, "status");
    assert(typeof data.token === "string", "token should be a string");
    demoToken = data.token;
  });

  await test("login succeeds for ana", async () => {
    const { status, data } = await api("POST", "/auth/login", {
      body: { email: "ana@example.com", password: "ana123" },
    });
    assertEqual(status, 200, "status");
    anaToken = data.token;
  });

  await test("/auth/me requires a token", async () => {
    const { status } = await api("GET", "/auth/me");
    assertEqual(status, 401, "status");
  });

  await test("/auth/me returns the current user", async () => {
    const { status, data } = await api("GET", "/auth/me", { token: demoToken });
    assertEqual(status, 200, "status");
    assertEqual(data.user.email, "demo@example.com", "email");
  });

  // ---------------------------------------------------------------------------
  // ACCOUNTS
  // ---------------------------------------------------------------------------

  await test("GET /accounts requires auth", async () => {
    const { status } = await api("GET", "/accounts");
    assertEqual(status, 401, "status");
  });

  await test("GET /accounts returns only the user's own accounts, with balance", async () => {
    const { status, data } = await api("GET", "/accounts", { token: demoToken });
    assertEqual(status, 200, "status");
    assertEqual(data.accounts.length, 2, "accounts.length");
    assert(typeof data.accounts[0].balance === "number", "balance should be a number");
  });

  await test("GET /accounts/:id for another user's account returns 404", async () => {
    const { status } = await api("GET", "/accounts/acc-4", { token: demoToken });
    assertEqual(status, 404, "status");
  });

  await test("POST /accounts validates currency", async () => {
    const { status } = await api("POST", "/accounts", {
      token: demoToken,
      body: { name: "Cuenta invalida", currency: "XXX" },
    });
    assertEqual(status, 400, "status");
  });

  await test("POST /accounts creates a new account with balance 0", async () => {
    const { status, data } = await api("POST", "/accounts", {
      token: demoToken,
      body: { name: "Cuenta Ahorro", currency: "ARS" },
    });
    assertEqual(status, 201, "status");
    assertEqual(data.account.balance, 0, "balance");
  });

  await test("PUT /accounts/:id ignores currency changes", async () => {
    const { status, data } = await api("PUT", "/accounts/acc-1", {
      token: demoToken,
      body: { name: "Cuenta Pesos Renombrada", currency: "USD" },
    });
    assertEqual(status, 200, "status");
    assertEqual(data.account.name, "Cuenta Pesos Renombrada", "name");
    assertEqual(data.account.currency, "ARS", "currency should stay unchanged");
  });

  // ---------------------------------------------------------------------------
  // TRANSACTIONS
  // ---------------------------------------------------------------------------

  await test("GET /transactions filters by accountId and paginates", async () => {
    const { status, data } = await api("GET", "/transactions?accountId=acc-1&pageSize=5", {
      token: demoToken,
    });
    assertEqual(status, 200, "status");
    assert(data.transactions.length <= 5, "pageSize should be respected");
    assert(data.pagination.total >= 10, "acc-1 should have at least 10 transactions");
  });

  await test("GET /transactions with a foreign accountId returns 404", async () => {
    const { status } = await api("GET", "/transactions?accountId=acc-4", { token: demoToken });
    assertEqual(status, 404, "status");
  });

  await test("POST /transactions validates amount and type", async () => {
    const { status } = await api("POST", "/transactions", {
      token: demoToken,
      body: { accountId: "acc-1", type: "deposit", amount: -5 },
    });
    assertEqual(status, 400, "status");
  });

  await test("POST /transactions creates an expense and updates the balance", async () => {
    const before = await api("GET", "/accounts/acc-1", { token: demoToken });
    const balanceBefore = before.data.account.balance;

    const { status, data } = await api("POST", "/transactions", {
      token: demoToken,
      body: { accountId: "acc-1", type: "expense", amount: 1000, category: "other", description: "Test expense" },
    });
    assertEqual(status, 201, "status");
    assertEqual(data.transaction.status, "completed", "status should be completed immediately");

    const after = await api("GET", "/accounts/acc-1", { token: demoToken });
    assertEqual(after.data.account.balance, balanceBefore - 1000, "balance after expense");
  });

  await test("PATCH /transactions/:id can edit category and description", async () => {
    const { status, data } = await api("PATCH", "/transactions/txn-3", {
      token: demoToken,
      body: { category: "other", description: "Supermercado (editado)" },
    });
    assertEqual(status, 200, "status");
    assertEqual(data.transaction.description, "Supermercado (editado)", "description");
  });

  // ---------------------------------------------------------------------------
  // TRANSFERS
  // ---------------------------------------------------------------------------

  await test("POST /transfers fails with insufficient funds", async () => {
    const { status, data } = await api("POST", "/transfers", {
      token: demoToken,
      body: { fromAccountId: "acc-2", toAccountId: "acc-4", amount: 999999, description: "Too much" },
    });
    assertEqual(status, 422, "status");
    assert(typeof data.error === "string", "error message should be present");
  });

  await test("POST /transfers rejects transferring to the same account", async () => {
    const { status } = await api("POST", "/transfers", {
      token: demoToken,
      body: { fromAccountId: "acc-1", toAccountId: "acc-1", amount: 10 },
    });
    assertEqual(status, 400, "status");
  });

  await test("POST /transfers starts as pending and settles to completed", async () => {
    const { status, data } = await api("POST", "/transfers", {
      token: demoToken,
      body: { fromAccountId: "acc-1", toAccountId: "acc-4", amount: 5000, description: "Test transfer" },
    });
    assertEqual(status, 201, "status");
    assertEqual(data.transfer.status, "pending", "initial status should be pending");

    await sleep(1800);

    const followUp = await api("GET", `/transfers/${data.transfer.id}`, { token: demoToken });
    assertEqual(followUp.data.transfer.status, "completed", "status should settle to completed");
  });

  await test("a transfer is only visible to the owner of each side", async () => {
    const { status, data } = await api("GET", "/transfers/transfer-seed-1", { token: anaToken });
    assertEqual(status, 200, "status");
    assert(data.transfer.to !== null, "ana should see her own side");
    assert(data.transfer.from === null, "ana should not see demo's side of the ledger");
  });

  await test("PATCH on a transfer is rejected", async () => {
    const { status } = await api("PATCH", "/transactions/transfer-seed-1-out", {
      token: demoToken,
      body: { description: "intento de edicion" },
    });
    assertEqual(status, 400, "status");
  });

  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------

  await test("GET /categories returns the fixed category list", async () => {
    const { status, data } = await api("GET", "/categories", { token: demoToken });
    assertEqual(status, 200, "status");
    assert(data.categories.includes("groceries"), "categories should include groceries");
  });

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------

  console.log("\n" + "=".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  if (failed === 0) {
    console.log(`\n✅ All ${passed} tests passed!\n`);
  } else {
    console.log(`\n❌ ${failed} tests failed, ${passed} passed\n`);
    console.log("Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    console.log("");
    process.exit(1);
  }
}

// Run
runTests().catch((err) => {
  console.error("\n❌ Test suite crashed:", err.message);
  process.exit(1);
});
