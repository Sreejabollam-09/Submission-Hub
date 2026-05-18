import { Router } from "express";
import { db } from "@workspace/db";
import { goalCyclesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function formatCycle(c: typeof goalCyclesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    year: c.year,
    status: c.status,
    goalSettingStart: c.goalSettingStart.toISOString(),
    goalSettingEnd: c.goalSettingEnd.toISOString(),
    q1Start: c.q1Start?.toISOString() ?? null,
    q1End: c.q1End?.toISOString() ?? null,
    q2Start: c.q2Start?.toISOString() ?? null,
    q2End: c.q2End?.toISOString() ?? null,
    q3Start: c.q3Start?.toISOString() ?? null,
    q3End: c.q3End?.toISOString() ?? null,
    q4Start: c.q4Start?.toISOString() ?? null,
    q4End: c.q4End?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

// GET /api/cycles
router.get("/", async (_req, res) => {
  const cycles = await db.select().from(goalCyclesTable).orderBy(goalCyclesTable.year);
  res.json(cycles.map(formatCycle));
});

// GET /api/cycles/active
router.get("/active", async (_req, res) => {
  const [cycle] = await db.select().from(goalCyclesTable).where(eq(goalCyclesTable.status, "active")).limit(1);
  if (!cycle) {
    res.status(404).json({ error: "No active cycle" });
    return;
  }
  res.json(formatCycle(cycle));
});

// POST /api/cycles
router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const [created] = await db.insert(goalCyclesTable).values({
    name: body.name,
    year: body.year,
    goalSettingStart: new Date(body.goalSettingStart),
    goalSettingEnd: new Date(body.goalSettingEnd),
    q1Start: body.q1Start ? new Date(body.q1Start) : null,
    q1End: body.q1End ? new Date(body.q1End) : null,
    q2Start: body.q2Start ? new Date(body.q2Start) : null,
    q2End: body.q2End ? new Date(body.q2End) : null,
    q3Start: body.q3Start ? new Date(body.q3Start) : null,
    q3End: body.q3End ? new Date(body.q3End) : null,
    q4Start: body.q4Start ? new Date(body.q4Start) : null,
    q4End: body.q4End ? new Date(body.q4End) : null,
  }).returning();
  res.status(201).json(formatCycle(created));
});

// PATCH /api/cycles/:id
router.patch("/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const body = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates["name"] = body.name;
  if (body.status !== undefined) updates["status"] = body.status;
  if (body.goalSettingStart !== undefined) updates["goalSettingStart"] = new Date(body.goalSettingStart);
  if (body.goalSettingEnd !== undefined) updates["goalSettingEnd"] = new Date(body.goalSettingEnd);
  if (body.q1Start !== undefined) updates["q1Start"] = new Date(body.q1Start);
  if (body.q1End !== undefined) updates["q1End"] = new Date(body.q1End);
  if (body.q2Start !== undefined) updates["q2Start"] = new Date(body.q2Start);
  if (body.q2End !== undefined) updates["q2End"] = new Date(body.q2End);
  if (body.q3Start !== undefined) updates["q3Start"] = new Date(body.q3Start);
  if (body.q3End !== undefined) updates["q3End"] = new Date(body.q3End);
  if (body.q4Start !== undefined) updates["q4Start"] = new Date(body.q4Start);
  if (body.q4End !== undefined) updates["q4End"] = new Date(body.q4End);

  const [updated] = await db.update(goalCyclesTable).set(updates).where(eq(goalCyclesTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Cycle not found" });
    return;
  }
  res.json(formatCycle(updated));
});

export default router;
