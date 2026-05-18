import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// POST /api/auth/sso — simulated Azure AD SSO
// In a real implementation this would validate an Azure AD token via MSAL
// For the hackathon demo we match on email (simulating the AAD UPN claim)
router.post("/sso", async (req, res) => {
  const { email, aadToken } = req.body ?? {};
  if (!email) { res.status(400).json({ error: "email required" }); return; }

  // Simulate AAD token validation — in prod use @azure/msal-node
  if (!aadToken || !aadToken.startsWith("aad_demo_")) {
    res.status(401).json({ error: "Invalid AAD token" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found in directory. Contact your administrator." }); return;
  }

  let managerName: string | null = null;
  if (user.managerId) {
    const [mgr] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, user.managerId)).limit(1);
    managerName = mgr?.name ?? null;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    designation: user.designation,
    managerId: user.managerId,
    managerName,
    ssoProvider: "microsoft",
  });
});

export default router;
