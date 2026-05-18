import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: string;
  designation: string | null;
  managerId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = Number(userId);
  if (isNaN(id)) {
    res.status(401).json({ error: "Invalid user id" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as "employee" | "manager" | "admin",
    department: user.department,
    designation: user.designation,
    managerId: user.managerId,
  };
  next();
}

export async function logAudit(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  oldValue?: string,
  newValue?: string,
  reason?: string
) {
  const { auditLogsTable } = await import("@workspace/db");
  await db.insert(auditLogsTable).values({
    userId,
    action,
    entityType,
    entityId,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    reason: reason ?? null,
  });
}
