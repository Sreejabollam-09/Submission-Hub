import { Router } from "express";
import { db } from "@workspace/db";
import {
  goalsTable,
  goalSheetsTable,
  thrustAreasTable,
  auditLogsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function formatGoal(g: typeof goalsTable.$inferSelect) {
  const [area] = await db.select({ name: thrustAreasTable.name })
    .from(thrustAreasTable).where(eq(thrustAreasTable.id, g.thrustAreaId)).limit(1);
  return {
    id: g.id,
    goalSheetId: g.goalSheetId,
    thrustAreaId: g.thrustAreaId,
    thrustAreaName: area?.name ?? "",
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
  };
}

// POST /api/goal-sheets/:sheetId/goals
router.post("/goal-sheets/:sheetId/goals", async (req, res) => {
  const sheetId = Number(req.params["sheetId"]);
  const userId = req.headers["x-user-id"];
  const body = req.body ?? {};

  // Check sheet exists and not locked
  const [sheet] = await db.select().from(goalSheetsTable).where(eq(goalSheetsTable.id, sheetId)).limit(1);
  if (!sheet) {
    res.status(404).json({ error: "Goal sheet not found" });
    return;
  }
  if (sheet.isLocked) {
    res.status(403).json({ error: "Goal sheet is locked" });
    return;
  }

  // Max 8 goals
  const existingGoals = await db.select().from(goalsTable).where(eq(goalsTable.goalSheetId, sheetId));
  if (existingGoals.length >= 8) {
    res.status(400).json({ error: "Maximum 8 goals per employee" });
    return;
  }

  // Min weightage 10%
  if (body.weightage < 10) {
    res.status(400).json({ error: "Minimum weightage per goal is 10%" });
    return;
  }

  const [created] = await db.insert(goalsTable).values({
    goalSheetId: sheetId,
    thrustAreaId: body.thrustAreaId,
    title: body.title,
    description: body.description,
    uomType: body.uomType,
    uomUnit: body.uomUnit ?? null,
    target: body.target,
    weightage: body.weightage,
    status: "not_started",
    isShared: false,
    isReadOnly: false,
  }).returning();

  await db.insert(auditLogsTable).values({
    userId: Number(userId),
    action: "create_goal",
    entityType: "goal",
    entityId: created.id,
    newValue: JSON.stringify({ title: body.title, weightage: body.weightage }),
    oldValue: null,
    reason: null,
  });

  res.status(201).json(await formatGoal(created));
});

// PATCH /api/goals/:id
router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const userId = req.headers["x-user-id"];
  const body = req.body ?? {};

  const [existing] = await db.select().from(goalsTable).where(eq(goalsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  // Check if sheet is locked
  const [sheet] = await db.select().from(goalSheetsTable).where(eq(goalSheetsTable.id, existing.goalSheetId)).limit(1);
  if (sheet?.isLocked && existing.isReadOnly) {
    res.status(403).json({ error: "This goal is read-only" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (body.thrustAreaId !== undefined) updates["thrustAreaId"] = body.thrustAreaId;
  if (body.title !== undefined && !existing.isReadOnly) updates["title"] = body.title;
  if (body.description !== undefined && !existing.isReadOnly) updates["description"] = body.description;
  if (body.uomType !== undefined && !existing.isReadOnly) updates["uomType"] = body.uomType;
  if (body.uomUnit !== undefined) updates["uomUnit"] = body.uomUnit;
  if (body.target !== undefined && !existing.isReadOnly) updates["target"] = body.target;
  if (body.weightage !== undefined) {
    if (body.weightage < 10) {
      res.status(400).json({ error: "Minimum weightage per goal is 10%" });
      return;
    }
    updates["weightage"] = body.weightage;
  }
  if (body.status !== undefined) updates["status"] = body.status;

  const [updated] = await db.update(goalsTable).set(updates).where(eq(goalsTable.id, id)).returning();

  await db.insert(auditLogsTable).values({
    userId: Number(userId),
    action: "update_goal",
    entityType: "goal",
    entityId: id,
    oldValue: JSON.stringify({ title: existing.title, weightage: existing.weightage }),
    newValue: JSON.stringify(updates),
    reason: null,
  });

  res.json(await formatGoal(updated));
});

// DELETE /api/goals/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const userId = req.headers["x-user-id"];

  const [existing] = await db.select().from(goalsTable).where(eq(goalsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const [sheet] = await db.select().from(goalSheetsTable).where(eq(goalSheetsTable.id, existing.goalSheetId)).limit(1);
  if (sheet?.isLocked) {
    res.status(403).json({ error: "Goal sheet is locked" });
    return;
  }

  await db.delete(goalsTable).where(eq(goalsTable.id, id));

  await db.insert(auditLogsTable).values({
    userId: Number(userId),
    action: "delete_goal",
    entityType: "goal",
    entityId: id,
    oldValue: JSON.stringify({ title: existing.title }),
    newValue: null,
    reason: null,
  });

  res.status(204).send();
});

export default router;
