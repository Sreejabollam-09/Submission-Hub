import { Router } from "express";
import { db } from "@workspace/db";
import {
  sharedGoalsTable,
  goalsTable,
  goalSheetsTable,
  usersTable,
  thrustAreasTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

async function formatSharedGoal(sg: typeof sharedGoalsTable.$inferSelect) {
  const [area] = await db.select({ name: thrustAreasTable.name })
    .from(thrustAreasTable).where(eq(thrustAreasTable.id, sg.thrustAreaId)).limit(1);
  const [owner] = await db.select({ name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, sg.ownerEmployeeId)).limit(1);
  // Count linked goals
  const linkedGoals = await db.select().from(goalsTable).where(eq(goalsTable.sharedGoalId, sg.id));
  return {
    id: sg.id,
    title: sg.title,
    description: sg.description ?? "",
    thrustAreaId: sg.thrustAreaId,
    thrustAreaName: area?.name ?? "",
    target: sg.target,
    uomType: sg.uomType,
    cycleId: sg.cycleId,
    ownerEmployeeId: sg.ownerEmployeeId,
    ownerName: owner?.name ?? "",
    recipientCount: linkedGoals.length,
    createdAt: sg.createdAt.toISOString(),
  };
}

// GET /api/shared-goals
router.get("/", async (_req, res) => {
  const all = await db.select().from(sharedGoalsTable).orderBy(sharedGoalsTable.createdAt);
  const result = await Promise.all(all.map(formatSharedGoal));
  res.json(result);
});

// POST /api/shared-goals
router.post("/", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const body = req.body ?? {};

  // Create shared goal record
  const [sg] = await db.insert(sharedGoalsTable).values({
    title: body.title,
    description: body.description ?? null,
    thrustAreaId: body.thrustAreaId,
    target: body.target,
    uomType: body.uomType,
    cycleId: body.cycleId,
    ownerEmployeeId: Number(userId),
  }).returning();

  // Find or create goal sheets for each recipient and add read-only goal
  const recipientIds: number[] = body.recipientEmployeeIds ?? [];
  for (const empId of recipientIds) {
    // Find their goal sheet for this cycle
    const [sheet] = await db.select().from(goalSheetsTable)
      .where(and(eq(goalSheetsTable.employeeId, empId), eq(goalSheetsTable.cycleId, body.cycleId)))
      .limit(1);
    
    if (sheet && !sheet.isLocked) {
      await db.insert(goalsTable).values({
        goalSheetId: sheet.id,
        thrustAreaId: body.thrustAreaId,
        title: body.title,
        description: body.description ?? "",
        uomType: body.uomType,
        uomUnit: null,
        target: body.target,
        weightage: body.defaultWeightage,
        status: "not_started",
        isShared: true,
        sharedGoalId: sg.id,
        isReadOnly: true,
      });
    }
  }

  res.status(201).json(await formatSharedGoal(sg));
});

// PATCH /api/shared-goals/:id
router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const body = req.body ?? {};

  if (body.weightage !== undefined) {
    // Update weightage on all linked goals
    await db.update(goalsTable).set({ weightage: body.weightage }).where(eq(goalsTable.sharedGoalId, id));
  }

  const [sg] = await db.select().from(sharedGoalsTable).where(eq(sharedGoalsTable.id, id)).limit(1);
  if (!sg) {
    res.status(404).json({ error: "Shared goal not found" });
    return;
  }
  res.json(await formatSharedGoal(sg));
});

export default router;
