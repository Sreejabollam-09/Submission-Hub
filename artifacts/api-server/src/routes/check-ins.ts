import { Router } from "express";
import { db } from "@workspace/db";
import {
  checkInsTable,
  goalUpdatesTable,
  goalsTable,
  usersTable,
  goalSheetsTable,
  thrustAreasTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

function calcProgressScore(uomType: string, target: string, achievement: string): number | null {
  if (!achievement) return null;
  try {
    if (uomType === "numeric_min") {
      const t = parseFloat(target);
      const a = parseFloat(achievement);
      return t > 0 ? Math.min((a / t) * 100, 100) : null;
    } else if (uomType === "numeric_max") {
      const t = parseFloat(target);
      const a = parseFloat(achievement);
      return a > 0 ? Math.min((t / a) * 100, 100) : null;
    } else if (uomType === "zero") {
      return achievement === "0" ? 100 : 0;
    } else if (uomType === "timeline") {
      return null; // Handled on frontend
    }
  } catch {
    return null;
  }
  return null;
}

async function formatCheckIn(ci: typeof checkInsTable.$inferSelect) {
  const [emp] = await db.select({ name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, ci.employeeId)).limit(1);
  return {
    id: ci.id,
    goalSheetId: ci.goalSheetId,
    employeeId: ci.employeeId,
    employeeName: emp?.name ?? "",
    cycleId: ci.cycleId,
    quarter: ci.quarter,
    status: ci.status,
    managerComment: ci.managerComment,
    reviewedAt: ci.reviewedAt?.toISOString() ?? null,
    submittedAt: ci.submittedAt?.toISOString() ?? null,
    overallProgress: ci.overallProgress,
    createdAt: ci.createdAt.toISOString(),
  };
}

// GET /api/check-ins
router.get("/", async (req, res) => {
  const { cycleId, quarter, goalSheetId } = req.query as Record<string, string>;
  const userId = req.headers["x-user-id"];

  let all = await db.select().from(checkInsTable);

  // Role-based filtering
  if (userId) {
    const userIdNum = Number(userId);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userIdNum)).limit(1);
    if (user?.role === "employee") {
      all = all.filter((ci) => ci.employeeId === userIdNum);
    } else if (user?.role === "manager") {
      const team = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.managerId, userIdNum));
      const teamIds = team.map((m) => m.id);
      all = all.filter((ci) => teamIds.includes(ci.employeeId) || ci.employeeId === userIdNum);
    }
  }

  if (cycleId) all = all.filter((ci) => ci.cycleId === Number(cycleId));
  if (quarter) all = all.filter((ci) => ci.quarter === quarter);
  if (goalSheetId) all = all.filter((ci) => ci.goalSheetId === Number(goalSheetId));

  const result = await Promise.all(all.map(formatCheckIn));
  res.json(result);
});

// POST /api/check-ins
router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const userId = req.headers["x-user-id"];

  // Check for existing
  const [existing] = await db.select().from(checkInsTable)
    .where(and(
      eq(checkInsTable.goalSheetId, body.goalSheetId),
      eq(checkInsTable.quarter, body.quarter)
    )).limit(1);
  
  if (existing) {
    res.json(await formatCheckIn(existing));
    return;
  }

  const [created] = await db.insert(checkInsTable).values({
    goalSheetId: body.goalSheetId,
    employeeId: Number(userId),
    cycleId: body.cycleId,
    quarter: body.quarter,
    status: "pending",
  }).returning();
  res.status(201).json(await formatCheckIn(created));
});

// GET /api/check-ins/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const [ci] = await db.select().from(checkInsTable).where(eq(checkInsTable.id, id)).limit(1);
  if (!ci) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }
  const base = await formatCheckIn(ci);

  // Get goal updates
  const updates = await db.select().from(goalUpdatesTable).where(eq(goalUpdatesTable.checkInId, id));
  const goalIds = [...new Set(updates.map((u) => u.goalId))];
  const goals = goalIds.length
    ? await db.select().from(goalsTable).where(inArray(goalsTable.id, goalIds))
    : [];
  const areaIds = [...new Set(goals.map((g) => g.thrustAreaId))];
  const areas = areaIds.length
    ? await db.select().from(thrustAreasTable).where(inArray(thrustAreasTable.id, areaIds))
    : [];
  const areaMap = new Map(areas.map((a) => [a.id, a.name]));
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  const formattedUpdates = updates.map((u) => {
    const goal = goalMap.get(u.goalId);
    return {
      id: u.id,
      checkInId: u.checkInId,
      goalId: u.goalId,
      goalTitle: goal?.title ?? "",
      thrustAreaName: goal ? (areaMap.get(goal.thrustAreaId) ?? "") : "",
      target: goal?.target ?? "",
      uomType: goal?.uomType ?? "",
      achievement: u.achievement,
      status: u.status,
      notes: u.notes,
      progressScore: u.progressScore,
      weightage: goal?.weightage ?? 0,
      createdAt: u.createdAt.toISOString(),
    };
  });

  res.json({ ...base, goalUpdates: formattedUpdates });
});

// PATCH /api/check-ins/:id
router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates["status"] = body.status;
  const [updated] = await db.update(checkInsTable).set(updates).where(eq(checkInsTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }
  res.json(await formatCheckIn(updated));
});

// POST /api/check-ins/:id/manager-review
router.post("/:id/manager-review", async (req, res) => {
  const id = Number(req.params["id"]);
  const body = req.body ?? {};
  const [updated] = await db.update(checkInsTable)
    .set({ managerComment: body.comment, status: "reviewed", reviewedAt: new Date() })
    .where(eq(checkInsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }
  res.json(await formatCheckIn(updated));
});

// POST /api/check-ins/:id/submit
router.post("/:id/submit", async (req, res) => {
  const id = Number(req.params["id"]);

  // Calculate overall progress
  const updates = await db.select().from(goalUpdatesTable).where(eq(goalUpdatesTable.checkInId, id));
  const goalIds = updates.map((u) => u.goalId);
  const goals = goalIds.length
    ? await db.select().from(goalsTable).where(inArray(goalsTable.id, goalIds))
    : [];
  
  let overallProgress: number | null = null;
  if (updates.length > 0 && goals.length > 0) {
    const goalMap = new Map(goals.map((g) => [g.id, g]));
    let totalWeightedScore = 0;
    let totalWeightage = 0;
    for (const u of updates) {
      const goal = goalMap.get(u.goalId);
      if (goal && u.progressScore !== null && u.progressScore !== undefined) {
        totalWeightedScore += u.progressScore * goal.weightage;
        totalWeightage += goal.weightage;
      }
    }
    overallProgress = totalWeightage > 0 ? totalWeightedScore / totalWeightage : null;
  }

  const [updated] = await db.update(checkInsTable)
    .set({ status: "submitted", submittedAt: new Date(), overallProgress })
    .where(eq(checkInsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }
  res.json(await formatCheckIn(updated));
});

// POST /api/check-ins/:checkInId/goal-updates
router.post("/:checkInId/goal-updates", async (req, res) => {
  const checkInId = Number(req.params["checkInId"]);
  const body = req.body ?? {};

  // Get goal to compute progress
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.id, body.goalId)).limit(1);
  const progressScore = goal
    ? calcProgressScore(goal.uomType, goal.target, body.achievement)
    : null;

  // Upsert
  const [existing] = await db.select().from(goalUpdatesTable)
    .where(and(eq(goalUpdatesTable.checkInId, checkInId), eq(goalUpdatesTable.goalId, body.goalId)))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(goalUpdatesTable)
      .set({
        achievement: body.achievement,
        status: body.status,
        notes: body.notes ?? null,
        progressScore,
      })
      .where(eq(goalUpdatesTable.id, existing.id))
      .returning();

    // Also update goal status
    await db.update(goalsTable).set({ status: body.status }).where(eq(goalsTable.id, body.goalId));

    return res.json({
      id: updated.id,
      checkInId: updated.checkInId,
      goalId: updated.goalId,
      achievement: updated.achievement,
      status: updated.status,
      notes: updated.notes,
      progressScore: updated.progressScore,
      createdAt: updated.createdAt.toISOString(),
    });
  }

  const [created] = await db.insert(goalUpdatesTable).values({
    checkInId,
    goalId: body.goalId,
    achievement: body.achievement,
    status: body.status,
    notes: body.notes ?? null,
    progressScore,
  }).returning();

  // Also update goal status and mark check-in in_progress
  await db.update(goalsTable).set({ status: body.status }).where(eq(goalsTable.id, body.goalId));
  await db.update(checkInsTable).set({ status: "in_progress" }).where(eq(checkInsTable.id, checkInId));

  res.json({
    id: created.id,
    checkInId: created.checkInId,
    goalId: created.goalId,
    achievement: created.achievement,
    status: created.status,
    notes: created.notes,
    progressScore: created.progressScore,
    createdAt: created.createdAt.toISOString(),
  });
});

export default router;
