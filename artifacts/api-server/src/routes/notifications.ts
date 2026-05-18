import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// GET /api/notifications — get notifications for the current user
router.get("/", async (req, res) => {
  const userId = Number(req.headers["x-user-id"]);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.sentAt))
    .limit(50);
  res.json(rows.map(r => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    channel: r.channel,
    relatedEntityType: r.relatedEntityType,
    relatedEntityId: r.relatedEntityId,
    isRead: r.isRead,
    sentAt: r.sentAt.toISOString(),
  })));
});

// GET /api/notifications/all — admin: all notifications
router.get("/all", async (req, res) => {
  const userId = Number(req.headers["x-user-id"]);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.sentAt))
    .limit(200);
  res.json(rows.map(r => ({
    id: r.id,
    userId: r.userId,
    type: r.type,
    title: r.title,
    body: r.body,
    channel: r.channel,
    relatedEntityType: r.relatedEntityType,
    relatedEntityId: r.relatedEntityId,
    isRead: r.isRead,
    sentAt: r.sentAt.toISOString(),
  })));
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res) => {
  const userId = Number(req.headers["x-user-id"]);
  const id = Number(req.params.id);
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
  res.json({ ok: true });
});

// POST /api/notifications/mark-all-read
router.post("/mark-all-read", async (req, res) => {
  const userId = Number(req.headers["x-user-id"]);
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, userId));
  res.json({ ok: true });
});

export default router;
