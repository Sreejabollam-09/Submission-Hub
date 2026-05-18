import { Router } from "express";
import { db } from "@workspace/db";
import {
  escalationRulesTable, escalationLogsTable, notificationsTable,
  usersTable, goalSheetsTable, checkInsTable, goalCyclesTable,
} from "@workspace/db";
import { eq, and, desc, not, inArray } from "drizzle-orm";

const router = Router();

// GET /api/escalation-rules
router.get("/rules", async (req, res) => {
  const rules = await db.select().from(escalationRulesTable).orderBy(escalationRulesTable.id);
  res.json(rules);
});

// POST /api/escalation-rules
router.post("/rules", async (req, res) => {
  const userId = Number(req.headers["x-user-id"]);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, triggerType, thresholdDays, active } = req.body;
  if (!name || !triggerType || thresholdDays == null) {
    res.status(400).json({ error: "name, triggerType, thresholdDays required" }); return;
  }
  const [rule] = await db.insert(escalationRulesTable).values({ name, triggerType, thresholdDays: Number(thresholdDays), active: active ?? true }).returning();
  res.json(rule);
});

// PATCH /api/escalation-rules/:id
router.patch("/rules/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, thresholdDays, active } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (thresholdDays !== undefined) updates.thresholdDays = Number(thresholdDays);
  if (active !== undefined) updates.active = active;
  const [updated] = await db.update(escalationRulesTable).set(updates).where(eq(escalationRulesTable.id, id)).returning();
  res.json(updated);
});

// DELETE /api/escalation-rules/:id
router.delete("/rules/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(escalationRulesTable).where(eq(escalationRulesTable.id, id));
  res.json({ ok: true });
});

// GET /api/escalations/logs — admin view
router.get("/logs", async (req, res) => {
  const logs = await db.select().from(escalationLogsTable).orderBy(desc(escalationLogsTable.createdAt)).limit(100);
  if (!logs.length) { res.json([]); return; }

  const userIds = [...new Set(logs.map(l => l.userId))];
  const users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(inArray(usersTable.id, userIds));
  const userMap = new Map(users.map(u => [u.id, u]));

  const ruleIds = [...new Set(logs.map(l => l.ruleId))];
  const rules = await db.select().from(escalationRulesTable).where(inArray(escalationRulesTable.id, ruleIds));
  const ruleMap = new Map(rules.map(r => [r.id, r]));

  res.json(logs.map(l => ({
    id: l.id,
    ruleId: l.ruleId,
    ruleName: ruleMap.get(l.ruleId)?.name ?? "Unknown Rule",
    triggerType: ruleMap.get(l.ruleId)?.triggerType ?? "",
    userId: l.userId,
    userName: userMap.get(l.userId)?.name ?? "Unknown",
    userEmail: userMap.get(l.userId)?.email ?? "",
    cycleId: l.cycleId,
    escalationLevel: l.escalationLevel,
    reason: l.reason,
    status: l.status,
    resolvedAt: l.resolvedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  })));
});

// PATCH /api/escalations/logs/:id/resolve
router.patch("/logs/:id/resolve", async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db.update(escalationLogsTable)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(escalationLogsTable.id, id))
    .returning();
  res.json(updated);
});

// POST /api/escalations/run — trigger the escalation engine
router.post("/run", async (req, res) => {
  const userId = Number(req.headers["x-user-id"]);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rules = await db.select().from(escalationRulesTable).where(eq(escalationRulesTable.active, true));
  const now = new Date();
  const results: Array<{ rule: string; triggered: number; notifications: number }> = [];

  // Get all active cycles
  const cycles = await db.select().from(goalCyclesTable);
  const activeCycle = cycles[0];
  if (!activeCycle) { res.json({ results: [], message: "No cycles found" }); return; }

  // Get all employees
  const employees = await db.select().from(usersTable).where(eq(usersTable.role, "employee"));

  for (const rule of rules) {
    let triggered = 0;
    let notifications = 0;
    const thresholdMs = rule.thresholdDays * 24 * 60 * 60 * 1000;

    if (rule.triggerType === "no_submission") {
      // Employees who have not submitted a goal sheet since cycle start
      const cycleStart = activeCycle.startDate;
      const daysSinceStart = (now.getTime() - cycleStart.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceStart < rule.thresholdDays) {
        results.push({ rule: rule.name, triggered: 0, notifications: 0 });
        continue;
      }

      const allSheets = await db.select().from(goalSheetsTable).where(eq(goalSheetsTable.cycleId, activeCycle.id));
      const submittedEmployeeIds = new Set(allSheets.filter(s => s.status !== "draft").map(s => s.employeeId));

      for (const emp of employees) {
        if (!submittedEmployeeIds.has(emp.id)) {
          // Check if we already have an open escalation for this
          const existing = await db.select().from(escalationLogsTable)
            .where(and(eq(escalationLogsTable.ruleId, rule.id), eq(escalationLogsTable.userId, emp.id), eq(escalationLogsTable.cycleId, activeCycle.id), eq(escalationLogsTable.status, "open")));
          if (existing.length > 0) continue;

          const reason = `${emp.name} has not submitted their goal sheet for ${activeCycle.name} within ${rule.thresholdDays} days of cycle start.`;
          await db.insert(escalationLogsTable).values({
            ruleId: rule.id, userId: emp.id, cycleId: activeCycle.id,
            escalationLevel: "employee", reason, status: "open",
          });
          // Notify employee
          await db.insert(notificationsTable).values({
            userId: emp.id, type: "escalation_employee",
            title: "Action Required: Submit your goal sheet",
            body: `Your goal sheet for ${activeCycle.name} has not been submitted. Please submit it as soon as possible to avoid further escalation.`,
            channel: "in_app", isRead: false,
          });
          await db.insert(notificationsTable).values({
            userId: emp.id, type: "escalation_employee",
            title: "Action Required: Submit your goal sheet",
            body: `Your goal sheet for ${activeCycle.name} has not been submitted. Please submit it as soon as possible to avoid further escalation.`,
            channel: "email", isRead: false,
          });
          // Notify manager
          if (emp.managerId) {
            await db.insert(notificationsTable).values({
              userId: emp.managerId, type: "escalation_manager",
              title: `Escalation: ${emp.name} has not submitted goals`,
              body: `${emp.name} has not submitted their goal sheet for ${activeCycle.name}. Please follow up.`,
              channel: "in_app", isRead: false,
            });
          }
          triggered++;
          notifications += emp.managerId ? 3 : 2;
        }
      }
    }

    if (rule.triggerType === "no_approval") {
      // Goal sheets submitted but not approved within N days
      const pendingSheets = await db.select().from(goalSheetsTable)
        .where(and(eq(goalSheetsTable.cycleId, activeCycle.id), eq(goalSheetsTable.status, "submitted")));

      for (const sheet of pendingSheets) {
        if (!sheet.submittedAt) continue;
        const daysPending = (now.getTime() - sheet.submittedAt.getTime()) / (24 * 60 * 60 * 1000);
        if (daysPending < rule.thresholdDays) continue;

        const existing = await db.select().from(escalationLogsTable)
          .where(and(eq(escalationLogsTable.ruleId, rule.id), eq(escalationLogsTable.userId, sheet.employeeId), eq(escalationLogsTable.cycleId, activeCycle.id), eq(escalationLogsTable.status, "open")));
        if (existing.length > 0) continue;

        const [emp] = await db.select().from(usersTable).where(eq(usersTable.id, sheet.employeeId)).limit(1);
        const reason = `Goal sheet for ${emp?.name ?? "employee"} has been pending approval for ${Math.floor(daysPending)} days.`;
        await db.insert(escalationLogsTable).values({
          ruleId: rule.id, userId: sheet.employeeId, cycleId: activeCycle.id,
          escalationLevel: "manager", reason, status: "open",
        });
        if (emp?.managerId) {
          await db.insert(notificationsTable).values({
            userId: emp.managerId, type: "escalation_manager",
            title: `Action Required: Approve ${emp.name}'s goal sheet`,
            body: `${emp.name}'s goal sheet has been pending your approval for ${Math.floor(daysPending)} days. Please review and approve or return it.`,
            channel: "in_app", isRead: false,
          });
          await db.insert(notificationsTable).values({
            userId: emp.managerId, type: "escalation_manager",
            title: `Action Required: Approve ${emp.name}'s goal sheet`,
            body: `${emp.name}'s goal sheet has been pending your approval for ${Math.floor(daysPending)} days. Please review and approve or return it.`,
            channel: "email", isRead: false,
          });
        }
        triggered++;
        notifications += 2;
      }
    }

    if (rule.triggerType === "no_checkin") {
      // Active quarter check-ins not submitted — check Q1 as example
      const currentQuarter = "Q1";
      const approvedSheets = await db.select().from(goalSheetsTable)
        .where(and(eq(goalSheetsTable.cycleId, activeCycle.id), eq(goalSheetsTable.status, "approved")));

      const submittedCheckIns = await db.select().from(checkInsTable)
        .where(and(eq(checkInsTable.cycleId, activeCycle.id), eq(checkInsTable.quarter, currentQuarter)));
      const submittedSet = new Set(submittedCheckIns.map(c => c.employeeId));

      for (const sheet of approvedSheets) {
        if (submittedSet.has(sheet.employeeId)) continue;
        const existing = await db.select().from(escalationLogsTable)
          .where(and(eq(escalationLogsTable.ruleId, rule.id), eq(escalationLogsTable.userId, sheet.employeeId), eq(escalationLogsTable.cycleId, activeCycle.id), eq(escalationLogsTable.status, "open")));
        if (existing.length > 0) continue;

        const [emp] = await db.select().from(usersTable).where(eq(usersTable.id, sheet.employeeId)).limit(1);
        const reason = `${emp?.name ?? "Employee"} has an approved goal sheet but has not submitted a ${currentQuarter} check-in.`;
        await db.insert(escalationLogsTable).values({
          ruleId: rule.id, userId: sheet.employeeId, cycleId: activeCycle.id,
          escalationLevel: "employee", reason, status: "open",
        });
        if (emp) {
          await db.insert(notificationsTable).values({
            userId: emp.id, type: "checkin_reminder",
            title: `Reminder: Submit your ${currentQuarter} check-in`,
            body: `You have not submitted your ${currentQuarter} check-in for ${activeCycle.name}. Please submit it before the quarter closes.`,
            channel: "in_app", isRead: false,
          });
        }
        triggered++;
        notifications++;
      }
    }

    results.push({ rule: rule.name, triggered, notifications });
  }

  res.json({ results, message: `Escalation check complete. ${results.reduce((a, r) => a + r.triggered, 0)} escalations triggered.` });
});

export default router;
