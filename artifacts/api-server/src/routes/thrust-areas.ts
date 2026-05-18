import { Router } from "express";
import { db } from "@workspace/db";
import { thrustAreasTable } from "@workspace/db";

const router = Router();

function formatArea(a: typeof thrustAreasTable.$inferSelect) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    createdAt: a.createdAt.toISOString(),
  };
}

// GET /api/thrust-areas
router.get("/", async (_req, res) => {
  const areas = await db.select().from(thrustAreasTable).orderBy(thrustAreasTable.name);
  res.json(areas.map(formatArea));
});

// POST /api/thrust-areas
router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const [created] = await db.insert(thrustAreasTable).values({
    name: body.name,
    description: body.description ?? null,
  }).returning();
  res.status(201).json(formatArea(created));
});

export default router;
