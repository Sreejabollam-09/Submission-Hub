import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type NotifType =
  | "goal_submitted" | "goal_approved" | "goal_returned"
  | "checkin_submitted" | "checkin_reminder"
  | "escalation_employee" | "escalation_manager" | "escalation_hr";

interface NotifPayload {
  userId: number;
  type: NotifType;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
}

async function createNotification(payload: NotifPayload, channels: Array<"in_app" | "email" | "teams"> = ["in_app", "email"]) {
  for (const channel of channels) {
    await db.insert(notificationsTable).values({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      channel,
      relatedEntityType: payload.relatedEntityType ?? null,
      relatedEntityId: payload.relatedEntityId ?? null,
      isRead: false,
    });
  }
}

// ── Wired notification helpers ───────────────────────────────────────────────

export async function notifyGoalSubmitted(opts: {
  employeeId: number;
  employeeName: string;
  managerId: number | null;
  cycleName: string;
  sheetId: number;
}) {
  // In-app + email to the manager
  if (opts.managerId) {
    await createNotification({
      userId: opts.managerId,
      type: "goal_submitted",
      title: `${opts.employeeName} submitted their goal sheet`,
      body: `${opts.employeeName} has submitted their goal sheet for ${opts.cycleName} and it is awaiting your review and approval.`,
      relatedEntityType: "goal_sheet",
      relatedEntityId: opts.sheetId,
    }, ["in_app", "email", "teams"]);
  }
  // In-app confirmation to employee
  await createNotification({
    userId: opts.employeeId,
    type: "goal_submitted",
    title: "Goal sheet submitted for approval",
    body: `Your goal sheet for ${opts.cycleName} has been submitted. Your manager will review it shortly.`,
    relatedEntityType: "goal_sheet",
    relatedEntityId: opts.sheetId,
  }, ["in_app", "email"]);
}

export async function notifyGoalApproved(opts: {
  employeeId: number;
  managerName: string;
  cycleName: string;
  sheetId: number;
}) {
  await createNotification({
    userId: opts.employeeId,
    type: "goal_approved",
    title: "Goal sheet approved!",
    body: `${opts.managerName} has approved your goal sheet for ${opts.cycleName}. You can now submit quarterly check-ins against your approved goals.`,
    relatedEntityType: "goal_sheet",
    relatedEntityId: opts.sheetId,
  }, ["in_app", "email", "teams"]);
}

export async function notifyGoalReturned(opts: {
  employeeId: number;
  managerName: string;
  cycleName: string;
  sheetId: number;
  comment: string | null;
}) {
  await createNotification({
    userId: opts.employeeId,
    type: "goal_returned",
    title: "Goal sheet returned for revision",
    body: `${opts.managerName} has returned your goal sheet for ${opts.cycleName} with feedback${opts.comment ? `: "${opts.comment}"` : ". Please review and resubmit."}`,
    relatedEntityType: "goal_sheet",
    relatedEntityId: opts.sheetId,
  }, ["in_app", "email", "teams"]);
}

export async function notifyCheckInSubmitted(opts: {
  employeeId: number;
  employeeName: string;
  managerId: number | null;
  quarter: string;
  cycleName: string;
  checkInId: number;
  overallProgress: number | null;
}) {
  if (opts.managerId) {
    const progress = opts.overallProgress !== null ? ` (Overall progress: ${opts.overallProgress.toFixed(1)}%)` : "";
    await createNotification({
      userId: opts.managerId,
      type: "checkin_submitted",
      title: `${opts.employeeName} submitted ${opts.quarter} check-in`,
      body: `${opts.employeeName} has submitted their ${opts.quarter} check-in for ${opts.cycleName}${progress}.`,
      relatedEntityType: "check_in",
      relatedEntityId: opts.checkInId,
    }, ["in_app", "email", "teams"]);
  }
  await createNotification({
    userId: opts.employeeId,
    type: "checkin_submitted",
    title: `${opts.quarter} check-in submitted`,
    body: `Your ${opts.quarter} check-in for ${opts.cycleName} has been submitted successfully.`,
    relatedEntityType: "check_in",
    relatedEntityId: opts.checkInId,
  }, ["in_app"]);
}
