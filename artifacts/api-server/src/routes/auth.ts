import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Simple password check (plain text for demo)
  if (user.passwordHash !== password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const [manager] = user.managerId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, user.managerId)).limit(1)
    : [null];

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      designation: user.designation,
      managerId: user.managerId,
      managerName: manager?.name ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    token: `token_${user.id}`,
  });
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  res.json({ success: true });
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const [manager] = user.managerId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, user.managerId)).limit(1)
    : [null];
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    designation: user.designation,
    managerId: user.managerId,
    managerName: manager?.name ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
