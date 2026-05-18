import { Router } from "express";
import { db } from "@workspace/db";
import {
  goalSheetsTable,
  checkInsTable,
  usersTable,
  thrustAreasTable,
  goalsTable,
  goalCyclesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

// GET /api/dashboard/summary
router.get("/summary", async (req, res) => {
  const { cycleId } = req.query as { cycleId?: string };

  const allEmployees = await db.select().from(usersTable).where(eq(usersTable.role, "employee"));
  const totalEmployees = allEmployees.length;

  let sheets = await db.select().from(goalSheetsTable);
  if (cycleId) sheets = sheets.filter((s) => s.cycleId === Number(cycleId));

  const goalsSubmitted = sheets.filter((s) => s.status === "submitted").length;
  const goalsApproved = sheets.filter((s) => s.status === "approved").length;
  const goalsDraft = sheets.filter((s) => s.status === "draft" || s.status === "returned").length;

  let checkIns = await db.select().from(checkInsTable);
  if (cycleId) checkIns = checkIns.filter((ci) => ci.cycleId === Number(cycleId));
  const checkInsCompleted = checkIns.filter((ci) => ci.status === "submitted" || ci.status === "reviewed").length;
  const checkInsPending = checkIns.filter((ci) => ci.status === "pending" || ci.status === "in_progress").length;

  const scores = checkIns.filter((ci) => ci.overallProgress !== null).map((ci) => ci.overallProgress as number);
  const avgCompletionRate = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // Determine current quarter
  const now = new Date();
  const month = now.getMonth() + 1;
  let currentQuarter: string | null = null;
  if (month >= 7 && month <= 9) currentQuarter = "Q1";
  else if (month >= 10 && month <= 12) currentQuarter = "Q2";
  else if (month >= 1 && month <= 3) currentQuarter = "Q3";
  else if (month >= 4 && month <= 6) currentQuarter = "Q4";

  res.json({
    totalEmployees,
    goalsSubmitted,
    goalsApproved,
    goalsDraft,
    avgCompletionRate,
    checkInsCompleted,
    checkInsPending,
    currentQuarter,
    cycleStatus: null,
  });
});

// GET /api/dashboard/team-progress
router.get("/team-progress", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { cycleId, quarter } = req.query as { cycleId?: string; quarter?: string };

  const userIdNum = userId ? Number(userId) : null;
  let teamMembers: { id: number; name: string; department: string }[] = [];

  if (userIdNum) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userIdNum)).limit(1);
    if (user?.role === "manager") {
      teamMembers = await db.select({ id: usersTable.id, name: usersTable.name, department: usersTable.department })
        .from(usersTable).where(eq(usersTable.managerId, userIdNum));
    } else if (user?.role === "admin") {
      teamMembers = await db.select({ id: usersTable.id, name: usersTable.name, department: usersTable.department })
        .from(usersTable).where(eq(usersTable.role, "employee"));
    }
  }

  const result = await Promise.all(teamMembers.map(async (member) => {
    let sheetQuery = await db.select().from(goalSheetsTable).where(eq(goalSheetsTable.employeeId, member.id));
    if (cycleId) sheetQuery = sheetQuery.filter((s) => s.cycleId === Number(cycleId));
    const sheet = sheetQuery[0];

    const goals = sheet
      ? await db.select().from(goalsTable).where(eq(goalsTable.goalSheetId, sheet.id))
      : [];

    let checkInQuery = await db.select().from(checkInsTable).where(eq(checkInsTable.employeeId, member.id));
    if (cycleId) checkInQuery = checkInQuery.filter((ci) => ci.cycleId === Number(cycleId));
    if (quarter) checkInQuery = checkInQuery.filter((ci) => ci.quarter === quarter);
    const checkIn = checkInQuery[0];

    return {
      employeeId: member.id,
      employeeName: member.name,
      department: member.department,
      goalSheetStatus: sheet?.status ?? "none",
      checkInStatus: checkIn?.status ?? null,
      progressScore: checkIn?.overallProgress ?? null,
      goalsCount: goals.length,
      completedGoals: goals.filter((g) => g.status === "completed").length,
    };
  }));

  res.json(result);
});

// GET /api/dashboard/completion-status
router.get("/completion-status", async (req, res) => {
  const { cycleId } = req.query as { cycleId?: string };

  const employees = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "employee"));
  const total = employees.length;

  let sheets = await db.select().from(goalSheetsTable);
  if (cycleId) sheets = sheets.filter((s) => s.cycleId === Number(cycleId));
  const approvedSheets = sheets.filter((s) => s.status === "approved").length;

  let checkIns = await db.select().from(checkInsTable);
  if (cycleId) checkIns = checkIns.filter((ci) => ci.cycleId === Number(cycleId));

  const q1Done = checkIns.filter((ci) => ci.quarter === "Q1" && (ci.status === "submitted" || ci.status === "reviewed")).length;
  const q2Done = checkIns.filter((ci) => ci.quarter === "Q2" && (ci.status === "submitted" || ci.status === "reviewed")).length;
  const q3Done = checkIns.filter((ci) => ci.quarter === "Q3" && (ci.status === "submitted" || ci.status === "reviewed")).length;
  const q4Done = checkIns.filter((ci) => ci.quarter === "Q4" && (ci.status === "submitted" || ci.status === "reviewed")).length;

  const safeTotal = total || 1;

  res.json({
    goalSetting: { total, completed: approvedSheets, percentage: (approvedSheets / safeTotal) * 100 },
    q1: { total, completed: q1Done, percentage: (q1Done / safeTotal) * 100 },
    q2: { total, completed: q2Done, percentage: (q2Done / safeTotal) * 100 },
    q3: { total, completed: q3Done, percentage: (q3Done / safeTotal) * 100 },
    q4: { total, completed: q4Done, percentage: (q4Done / safeTotal) * 100 },
  });
});

// GET /api/dashboard/thrust-area-breakdown
router.get("/thrust-area-breakdown", async (req, res) => {
  const { cycleId } = req.query as { cycleId?: string };

  const areas = await db.select().from(thrustAreasTable);
  let sheets = await db.select().from(goalSheetsTable);
  if (cycleId) sheets = sheets.filter((s) => s.cycleId === Number(cycleId));
  const sheetIds = sheets.map((s) => s.id);

  if (sheetIds.length === 0) {
    res.json(areas.map((a) => ({
      thrustAreaId: a.id,
      thrustAreaName: a.name,
      goalCount: 0,
      avgWeightage: 0,
      avgProgress: null,
    })));
    return;
  }

  const goals = await db.select().from(goalsTable).where(inArray(goalsTable.goalSheetId, sheetIds));

  const result = areas.map((area) => {
    const areaGoals = goals.filter((g) => g.thrustAreaId === area.id);
    const avgWeightage = areaGoals.length > 0
      ? areaGoals.reduce((sum, g) => sum + g.weightage, 0) / areaGoals.length
      : 0;
    return {
      thrustAreaId: area.id,
      thrustAreaName: area.name,
      goalCount: areaGoals.length,
      avgWeightage,
      avgProgress: null,
    };
  }).filter((a) => a.goalCount > 0);

  res.json(result);
});

export default router;
