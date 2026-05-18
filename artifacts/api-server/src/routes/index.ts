import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import cyclesRouter from "./cycles";
import thrustAreasRouter from "./thrust-areas";
import goalSheetsRouter from "./goal-sheets";
import goalsRouter from "./goals";
import sharedGoalsRouter from "./shared-goals";
import checkInsRouter from "./check-ins";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import { db } from "@workspace/db";
import { auditLogsTable, usersTable } from "@workspace/db";
import { desc, inArray } from "drizzle-orm";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/cycles", cyclesRouter);
router.use("/thrust-areas", thrustAreasRouter);
router.use("/goal-sheets", goalSheetsRouter);
router.use("/goals", goalsRouter);
router.use("/shared-goals", sharedGoalsRouter);
router.use("/check-ins", checkInsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/reports", reportsRouter);

// Standalone audit-logs endpoint
router.get("/audit-logs", async (req, res) => {
  const { entityType, entityId, limit } = req.query as { entityType?: string; entityId?: string; limit?: string };
  let logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.timestamp));
  if (entityType) logs = logs.filter((l) => l.entityType === entityType);
  if (entityId) logs = logs.filter((l) => l.entityId === Number(entityId));
  const limitNum = limit ? Math.min(Number(limit), 200) : 50;
  logs = logs.slice(0, limitNum);
  const userIds = [...new Set(logs.map((l) => l.userId))];
  const users = userIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  res.json(logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    userName: userMap.get(l.userId) ?? "Unknown",
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    oldValue: l.oldValue,
    newValue: l.newValue,
    reason: l.reason,
    createdAt: l.timestamp.toISOString(),
  })));
});

export default router;
