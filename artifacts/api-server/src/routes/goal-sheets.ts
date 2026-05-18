import { Router } from "express";
import { db } from "@workspace/db";
import {
  goalSheetsTable,
  goalsTable,
  usersTable,
  goalCyclesTable,
  thrustAreasTable,
  auditLogsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { notifyGoalSubmitted, notifyGoalApproved, notifyGoalReturned } from "../lib/notify";

const router = Router();

async function formatSheet(sheet: typeof goalSheetsTable.$inferSelect) {
  const [employee] = await db.select({ name: usersTable.name, department: usersTable.department })
    .from(usersTable).where(eq(usersTable.id, sheet.employeeId)).limit(1);
  const [cycle] = await db.select({ name: goalCyclesTable.name })
    .from(goalCyclesTable).where(eq(goalCyclesTable.id, sheet.cycleId)).limit(1);
  const goals = await db.select().from(goalsTable).where(eq(goalsTable.goalSheetId, sheet.id));
  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  return {
    id: sheet.id,
    employeeId: sheet.employeeId,
    employeeName: employee?.name ?? "",
    employeeDepartment: employee?.department ?? "",
    cycleId: sheet.cycleId,
    cycleName: cycle?.name ?? "",
    status: sheet.status,
    totalWeightage,
    goalsCount: goals.length,
    submittedAt: sheet.submittedAt?.toISOString() ?? null,
    approvedAt: sheet.approvedAt?.toISOString() ?? null,
    managerComment: sheet.managerComment,
    isLocked: sheet.isLocked,
    createdAt: sheet.createdAt.toISOString(),
    updatedAt: sheet.updatedAt.toISOString(),
  };
}

async function formatSheetDetail(sheet: typeof goalSheetsTable.$inferSelect) {
  const base = await formatSheet(sheet);
  const goals = await db.select().from(goalsTable).where(eq(goalsTable.goalSheetId, sheet.id));
  const thrustAreaIds = [...new Set(goals.map((g) => g.thrustAreaId))];
  const areas = thrustAreaIds.length
    ? await db.select().from(thrustAreasTable).where(inArray(thrustAreasTable.id, thrustAreaIds))
    : [];
  const areaMap = new Map(areas.map((a) => [a.id, a.name]));
  return {
    ...base,
    goals: goals.map((g) => ({
      id: g.id,
      goalSheetId: g.goalSheetId,
      thrustAreaId: g.thrustAreaId,
      thrustAreaName: areaMap.get(g.thrustAreaId) ?? "",
      title: g.title,
      description: g.description,
      uomType: g.uomType,
      uomUnit: g.uomUnit,
      target: g.target,
      weightage: g.weightage,
      status: g.status,
      isShared: g.isShared,
      sharedGoalId: g.sharedGoalId,
      isReadOnly: g.isReadOnly,
      progressScore: null,
      createdAt: g.createdAt.toISOString(),
    })),
  };
}

// GET /api/goal-sheets
router.get("/", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { cycleId, employeeId, status } = req.query as Record<string, string>;
  const userIdNum = userId ? Number(userId) : null;

  let allSheets = await db.select().from(goalSheetsTable);

  // Role-based filtering
  if (userIdNum) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userIdNum)).limit(1);
    if (user?.role === "employee") {
      allSheets = allSheets.filter((s) => s.employeeId === userIdNum);
    } else if (user?.role === "manager") {
      // Get all employees managed by this manager
      const teamMembers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, userIdNum));
      const teamIds = teamMembers.map((m) => m.id);
      allSheets = allSheets.filter((s) => teamIds.includes(s.employeeId) || s.employeeId === userIdNum);
    }
  }

  if (cycleId) allSheets = allSheets.filter((s) => s.cycleId === Number(cycleId));
  if (employeeId) allSheets = allSheets.filter((s) => s.employeeId === Number(employeeId));
  if (status) allSheets = allSheets.filter((s) => s.status === status);

  const result = await Promise.all(allSheets.map(formatSheet));
  res.json(result);
});

// POST /api/goal-sheets
router.post("/", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const body = req.body ?? {};
  const employeeId = userIdNum(userId as string);
  const [created] = await db.insert(goalSheetsTable).values({
    employeeId,
    cycleId: body.cycleId,
    status: "draft",
    isLocked: false,
  }).returning();
  const formatted = await formatSheet(created);
  res.status(201).json(formatted);
});

function userIdNum(userId: string | string[] | undefined): number {
  return Number(Array.isArray(userId) ? userId[0] : userId);
}

// GET /api/goal-sheets/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const [sheet] = await db.select().from(goalSheetsTable).where(eq(goalSheetsTable.id, id)).limit(1);
  if (!sheet) {
    res.status(404).json({ error: "Goal sheet not found" });
    return;
  }
  const detail = await formatSheetDetail(sheet);
  res.json(detail);
});

// PATCH /api/goal-sheets/:id
router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (body.managerComment !== undefined) updates["managerComment"] = body.managerComment;
  const [updated] = await db.update(goalSheetsTable).set(updates).where(eq(goalSheetsTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Goal sheet not found" });
    return;
  }
  res.json(await formatSheet(updated));
});

// POST /api/goal-sheets/:id/submit
router.post("/:id/submit", async (req, res) => {
  const id = Number(req.params["id"]);
  const userId = req.headers["x-user-id"];

  // Validate weightage
  const goals = await db.select().from(goalsTable).where(eq(goalsTable.goalSheetId, id));
  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (Math.abs(totalWeightage - 100) > 0.01) {
    res.status(400).json({ error: `Total weightage must be 100%. Current: ${totalWeightage.toFixed(1)}%` });
    return;
  }
  if (goals.length === 0) {
    res.status(400).json({ error: "At least one goal required" });
    return;
  }

  const [sheet] = await db.select().from(goalSheetsTable).where(eq(goalSheetsTable.id, id)).limit(1);
  if (!sheet || !["draft", "returned"].includes(sheet.status)) {
    res.status(400).json({ error: "Sheet not found or not in draft/returned status" });
    return;
  }
  const [updated] = await db.update(goalSheetsTable)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(eq(goalSheetsTable.id, id))
    .returning();

  // Audit log
  await db.insert(auditLogsTable).values({
    userId: Number(userId),
    action: "submit",
    entityType: "goal_sheet",
    entityId: id,
    newValue: "submitted",
    reason: null,
    oldValue: "draft",
  });

  // Notifications
  const [emp] = await db.select({ name: usersTable.name, managerId: usersTable.managerId }).from(usersTable).where(eq(usersTable.id, sheet.employeeId)).limit(1);
  const [cycle] = await db.select({ name: goalCyclesTable.name }).from(goalCyclesTable).where(eq(goalCyclesTable.id, sheet.cycleId)).limit(1);
  await notifyGoalSubmitted({ employeeId: sheet.employeeId, employeeName: emp?.name ?? "Employee", managerId: emp?.managerId ?? null, cycleName: cycle?.name ?? "", sheetId: id }).catch(() => {});

  res.json(await formatSheet(updated));
});

// POST /api/goal-sheets/:id/approve
router.post("/:id/approve", async (req, res) => {
  const id = Number(req.params["id"]);
  const userId = req.headers["x-user-id"];
  const body = req.body ?? {};
  const [updated] = await db.update(goalSheetsTable)
    .set({ status: "approved", isLocked: true, approvedAt: new Date(), managerComment: body.comment })
    .where(and(eq(goalSheetsTable.id, id), eq(goalSheetsTable.status, "submitted")))
    .returning();
  if (!updated) {
    res.status(400).json({ error: "Sheet not found or not submitted" });
    return;
  }
  await db.insert(auditLogsTable).values({
    userId: Number(userId),
    action: "approve",
    entityType: "goal_sheet",
    entityId: id,
    oldValue: "submitted",
    newValue: "approved",
    reason: body.comment,
  });
  // Notifications
  const [mgr] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1);
  const [approvedCycle] = await db.select({ name: goalCyclesTable.name }).from(goalCyclesTable).where(eq(goalCyclesTable.id, updated.cycleId)).limit(1);
  await notifyGoalApproved({ employeeId: updated.employeeId, managerName: mgr?.name ?? "Manager", cycleName: approvedCycle?.name ?? "", sheetId: id }).catch(() => {});
  res.json(await formatSheet(updated));
});

// POST /api/goal-sheets/:id/return
router.post("/:id/return", async (req, res) => {
  const id = Number(req.params["id"]);
  const userId = req.headers["x-user-id"];
  const body = req.body ?? {};
  const [updated] = await db.update(goalSheetsTable)
    .set({ status: "returned", isLocked: false, managerComment: body.comment })
    .where(and(eq(goalSheetsTable.id, id), eq(goalSheetsTable.status, "submitted")))
    .returning();
  if (!updated) {
    res.status(400).json({ error: "Sheet not found or not submitted" });
    return;
  }
  await db.insert(auditLogsTable).values({
    userId: Number(userId),
    action: "return",
    entityType: "goal_sheet",
    entityId: id,
    oldValue: "submitted",
    newValue: "returned",
    reason: body.comment,
  });
  // Notifications
  const [returnMgr] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1);
  const [returnCycle] = await db.select({ name: goalCyclesTable.name }).from(goalCyclesTable).where(eq(goalCyclesTable.id, updated.cycleId)).limit(1);
  await notifyGoalReturned({ employeeId: updated.employeeId, managerName: returnMgr?.name ?? "Manager", cycleName: returnCycle?.name ?? "", sheetId: id, comment: body.comment ?? null }).catch(() => {});
  res.json(await formatSheet(updated));
});

// POST /api/goal-sheets/:id/unlock
router.post("/:id/unlock", async (req, res) => {
  const id = Number(req.params["id"]);
  const userId = req.headers["x-user-id"];
  const body = req.body ?? {};
  const [updated] = await db.update(goalSheetsTable)
    .set({ isLocked: false, status: "draft" })
    .where(eq(goalSheetsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Sheet not found" });
    return;
  }
  await db.insert(auditLogsTable).values({
    userId: Number(userId),
    action: "unlock",
    entityType: "goal_sheet",
    entityId: id,
    oldValue: "locked",
    newValue: "unlocked",
    reason: body.reason,
  });
  res.json(await formatSheet(updated));
});

export default router;
