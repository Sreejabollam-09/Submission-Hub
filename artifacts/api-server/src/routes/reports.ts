import { Router } from "express";
import { db } from "@workspace/db";
import {
  goalSheetsTable,
  goalsTable,
  checkInsTable,
  goalUpdatesTable,
  usersTable,
  thrustAreasTable,
  auditLogsTable,
} from "@workspace/db";
import { eq, inArray, desc } from "drizzle-orm";

const router = Router();

// GET /api/reports/achievement
router.get("/achievement", async (req, res) => {
  const { cycleId, quarter } = req.query as { cycleId?: string; quarter?: string };

  let sheets = await db.select().from(goalSheetsTable);
  if (cycleId) sheets = sheets.filter((s) => s.cycleId === Number(cycleId));

  const sheetIds = sheets.map((s) => s.id);
  if (sheetIds.length === 0) {
    res.json([]);
    return;
  }

  const goals = await db.select().from(goalsTable).where(inArray(goalsTable.goalSheetId, sheetIds));
  const goalIds = goals.map((g) => g.id);

  let checkIns = await db.select().from(checkInsTable).where(inArray(checkInsTable.goalSheetId, sheetIds));
  if (quarter) checkIns = checkIns.filter((ci) => ci.quarter === quarter);

  const checkInIds = checkIns.map((ci) => ci.id);
  const goalUpdates = checkInIds.length
    ? await db.select().from(goalUpdatesTable).where(inArray(goalUpdatesTable.checkInId, checkInIds))
    : [];

  const employees = await db.select().from(usersTable);
  const areas = await db.select().from(thrustAreasTable);

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const areaMap = new Map(areas.map((a) => [a.id, a.name]));
  const sheetMap = new Map(sheets.map((s) => [s.id, s]));
  const goalMap = new Map(goals.map((g) => [g.id, g]));
  const checkInMap = new Map(checkIns.map((ci) => [ci.id, ci]));

  const result = [];
  for (const update of goalUpdates) {
    const checkIn = checkInMap.get(update.checkInId);
    if (!checkIn) continue;
    const sheet = sheetMap.get(checkIn.goalSheetId);
    if (!sheet) continue;
    const goal = goalMap.get(update.goalId);
    if (!goal) continue;
    const employee = empMap.get(sheet.employeeId);

    result.push({
      employeeName: employee?.name ?? "",
      department: employee?.department ?? "",
      goalTitle: goal.title,
      thrustArea: areaMap.get(goal.thrustAreaId) ?? "",
      uomType: goal.uomType,
      target: goal.target,
      weightage: goal.weightage,
      quarter: checkIn.quarter,
      achievement: update.achievement,
      progressScore: update.progressScore,
      status: update.status,
    });
  }

  res.json(result);
});

// GET /api/reports/goal-sheets
router.get("/goal-sheets", async (req, res) => {
  const { cycleId } = req.query as { cycleId?: string };
  let sheets = await db.select().from(goalSheetsTable);
  if (cycleId) sheets = sheets.filter((s) => s.cycleId === Number(cycleId));

  const employeeIds = [...new Set(sheets.map((s) => s.employeeId))];
  const employees = employeeIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, employeeIds))
    : [];
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const result = await Promise.all(sheets.map(async (sheet) => {
    const goals = await db.select().from(goalsTable).where(eq(goalsTable.goalSheetId, sheet.id));
    const emp = empMap.get(sheet.employeeId);
    return {
      id: sheet.id,
      employeeId: sheet.employeeId,
      employeeName: emp?.name ?? "",
      department: emp?.department ?? "",
      status: sheet.status,
      goalsCount: goals.length,
      totalWeightage: goals.reduce((s, g) => s + g.weightage, 0),
      submittedAt: sheet.submittedAt?.toISOString() ?? null,
      approvedAt: sheet.approvedAt?.toISOString() ?? null,
    };
  }));

  res.json(result);
});

// GET /api/audit-logs (mounted under /api/reports for backward compat)
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
    timestamp: l.timestamp.toISOString(),
  })));
});

export default router;
