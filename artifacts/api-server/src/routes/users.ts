import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect, managerName?: string | null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    designation: user.designation,
    managerId: user.managerId,
    managerName: managerName ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

// GET /api/users
router.get("/", async (req, res) => {
  const { role, managerId } = req.query as { role?: string; managerId?: string };
  let query = db.select().from(usersTable);
  const allUsers = await query;
  let filtered = allUsers;
  if (role) filtered = filtered.filter((u) => u.role === role);
  if (managerId) filtered = filtered.filter((u) => u.managerId === Number(managerId));

  const result = filtered.map((u) => {
    const mgr = u.managerId ? allUsers.find((m) => m.id === u.managerId) : null;
    return formatUser(u, mgr?.name);
  });
  res.json(result);
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [manager] = user.managerId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, user.managerId)).limit(1)
    : [null];
  res.json(formatUser(user, manager?.name));
});

export default router;
