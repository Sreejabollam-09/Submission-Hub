import { jsPDF } from "jspdf";

// ─── Colour palette (matches app theme) ────────────────────────────────────
const NAVY  = [30,  41,  82]  as [number, number, number];
const INDIGO = [79, 103, 215] as [number, number, number];
const GREEN  = [34, 152,  96] as [number, number, number];
const AMBER  = [217, 119,   6] as [number, number, number];
const RED    = [220,  38,  38] as [number, number, number];
const LIGHT  = [241, 243, 253] as [number, number, number];
const GRAY   = [107, 114, 128] as [number, number, number];
const LGRAY  = [229, 231, 235] as [number, number, number];
const WHITE  = [255, 255, 255] as [number, number, number];

const STATUS_COLOUR: Record<string, [number, number, number]> = {
  on_track:    GREEN,
  completed:   GREEN,
  at_risk:     AMBER,
  not_started: GRAY,
};

const Q_LABEL: Record<string, string> = {
  Q1: "Q1 (Jul–Sep)",
  Q2: "Q2 (Oct–Dec)",
  Q3: "Q3 (Jan–Mar)",
  Q4: "Q4 (Apr–Jun)",
};

interface GoalUpdate {
  goalId: number;
  goalTitle: string;
  thrustAreaName: string;
  target: string;
  uomType: string;
  uomUnit?: string;
  achievement: string;
  status: string;
  notes: string;
  progressScore: number | null;
  weightage: number;
}

interface CheckInData {
  quarter: string;
  status: string;
  overallProgress: number | null;
  submittedAt: string | null;
  goalUpdates: GoalUpdate[];
}

interface GoalData {
  id: number;
  title: string;
  thrustAreaName: string;
  uomType: string;
  uomUnit: string;
  target: string;
  weightage: number;
  status: string;
}

export interface ScorecardInput {
  employeeName: string;
  email: string;
  department: string;
  designation: string | null;
  managerName: string | null;
  cycleName: string;
  sheetStatus: string;
  submittedAt: string | null;
  approvedAt: string | null;
  goals: GoalData[];
  checkIns: CheckInData[];
  generatedOn: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}
function setFont(doc: jsPDF, rgb: [number, number, number], size: number, style: "normal" | "bold" = "normal") {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
}

function progressBar(doc: jsPDF, x: number, y: number, w: number, h: number, pct: number | null) {
  setFill(doc, LGRAY);
  setDraw(doc, LGRAY);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  if (pct !== null && pct > 0) {
    const colour = pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED;
    setFill(doc, colour);
    doc.roundedRect(x, y, Math.max(w * (pct / 100), h), h, h / 2, h / 2, "F");
  }
}

function scoreChip(doc: jsPDF, x: number, y: number, pct: number | null) {
  const label = pct !== null ? `${pct.toFixed(1)}%` : "—";
  const colour = pct === null ? GRAY : pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED;
  setFill(doc, colour);
  setDraw(doc, colour);
  doc.roundedRect(x - 14, y - 3.5, 28, 7, 1.5, 1.5, "F");
  setFont(doc, WHITE, 7.5, "bold");
  doc.text(label, x, y + 0.5, { align: "center" });
}

// Compute weighted final score across all quarters
function computeWeightedFinalScore(checkIns: CheckInData[], goals: GoalData[]): number | null {
  const goalMap = new Map(goals.map(g => [g.id, g]));

  // Collect per-goal per-quarter scores
  const goalScores: Record<number, number[]> = {};
  for (const ci of checkIns) {
    if (ci.status !== "submitted" && ci.status !== "reviewed") continue;
    for (const upd of ci.goalUpdates) {
      if (upd.progressScore === null || upd.progressScore === undefined) continue;
      if (!goalScores[upd.goalId]) goalScores[upd.goalId] = [];
      goalScores[upd.goalId].push(upd.progressScore);
    }
  }

  // Average scores per goal, then weight
  let totalWeightedScore = 0;
  let totalWeightage = 0;
  for (const [goalIdStr, scores] of Object.entries(goalScores)) {
    const goalId = Number(goalIdStr);
    const goal = goals.find(g => g.id === goalId);
    if (!goal || scores.length === 0) continue;
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    totalWeightedScore += avgScore * goal.weightage;
    totalWeightage += goal.weightage;
  }

  return totalWeightage > 0 ? totalWeightedScore / totalWeightage : null;
}

// ─── Main export ────────────────────────────────────────────────────────────
export function generateScorecard(data: ScorecardInput): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const MARGIN = 16;
  const CONTENT_W = W - MARGIN * 2;
  let y = 0;

  // ── COVER HEADER ──────────────────────────────────────────────────────────
  setFill(doc, NAVY);
  doc.rect(0, 0, W, 48, "F");

  // Logo circle
  setFill(doc, INDIGO);
  doc.circle(MARGIN + 10, 14, 8, "F");
  setFont(doc, WHITE, 10, "bold");
  doc.text("AQ", MARGIN + 10, 17, { align: "center" });

  // Title
  setFont(doc, WHITE, 18, "bold");
  doc.text("Employee Goal Scorecard", MARGIN + 24, 12);
  setFont(doc, [176, 196, 255], 9);
  doc.text(`${data.cycleName}  ·  ATOMQUEST HACKATHON 1.0`, MARGIN + 24, 19);

  // Generated on
  setFont(doc, [148, 163, 200], 7.5);
  doc.text(`Generated: ${data.generatedOn}`, W - MARGIN, 9, { align: "right" });

  // Horizontal rule
  setFill(doc, INDIGO);
  doc.rect(0, 46, W, 2, "F");

  y = 56;

  // ── EMPLOYEE INFO CARD ───────────────────────────────────────────────────
  setFill(doc, LIGHT);
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 2, 2, "F");

  const initials = data.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2);
  setFill(doc, INDIGO);
  doc.circle(MARGIN + 12, y + 14, 10, "F");
  setFont(doc, WHITE, 9, "bold");
  doc.text(initials, MARGIN + 12, y + 17, { align: "center" });

  setFont(doc, NAVY, 13, "bold");
  doc.text(data.employeeName, MARGIN + 28, y + 10);
  setFont(doc, GRAY, 8.5);
  doc.text(`${data.designation ?? ""}  ·  ${data.department}`, MARGIN + 28, y + 17);
  doc.text(`${data.email}`, MARGIN + 28, y + 23);

  if (data.managerName) {
    setFont(doc, GRAY, 8);
    doc.text(`Manager: ${data.managerName}`, W - MARGIN - 2, y + 10, { align: "right" });
  }

  const sheetCol = data.sheetStatus === "approved" ? GREEN : data.sheetStatus === "submitted" ? INDIGO : GRAY;
  setFill(doc, sheetCol);
  doc.roundedRect(W - MARGIN - 26, y + 17, 24, 7, 1.5, 1.5, "F");
  setFont(doc, WHITE, 7, "bold");
  doc.text(data.sheetStatus.toUpperCase(), W - MARGIN - 14, y + 22, { align: "center" });

  y += 36;

  // ── FINAL SCORE BANNER ───────────────────────────────────────────────────
  const finalScore = computeWeightedFinalScore(data.checkIns, data.goals);
  const scoreColour = finalScore === null ? GRAY : finalScore >= 80 ? GREEN : finalScore >= 50 ? AMBER : RED;

  setFill(doc, scoreColour);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 2, 2, "F");

  setFont(doc, WHITE, 9, "bold");
  doc.text("WEIGHTED FINAL ACHIEVEMENT SCORE", MARGIN + 6, y + 7);
  setFont(doc, WHITE, 8);
  doc.text("Average across all submitted quarterly check-ins, weighted by goal %", MARGIN + 6, y + 13);

  setFont(doc, WHITE, 20, "bold");
  doc.text(finalScore !== null ? `${finalScore.toFixed(1)}%` : "N/A", W - MARGIN - 4, y + 12, { align: "right" });

  y += 26;

  // ── GOAL SHEET ───────────────────────────────────────────────────────────
  setFont(doc, NAVY, 11, "bold");
  doc.text("Goal Sheet", MARGIN, y);
  setFill(doc, LGRAY);
  doc.line(MARGIN, y + 2, W - MARGIN, y + 2);
  y += 7;

  // Table header
  const COL = { title: MARGIN, area: MARGIN + 62, uom: MARGIN + 100, target: MARGIN + 124, wt: MARGIN + 144, score: MARGIN + 158 };
  setFill(doc, NAVY);
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  setFont(doc, WHITE, 7.5, "bold");
  doc.text("Goal", COL.title + 2, y + 5);
  doc.text("Thrust Area", COL.area + 2, y + 5);
  doc.text("UoM", COL.uom + 2, y + 5);
  doc.text("Target", COL.target + 2, y + 5);
  doc.text("Wt%", COL.wt + 2, y + 5);
  doc.text("Status", COL.score + 2, y + 5);
  y += 7;

  for (let i = 0; i < data.goals.length; i++) {
    const g = data.goals[i];
    const rowH = 8;
    setFill(doc, i % 2 === 0 ? WHITE : LIGHT);
    doc.rect(MARGIN, y, CONTENT_W, rowH, "F");

    const statusC = STATUS_COLOUR[g.status] ?? GRAY;
    setFont(doc, NAVY, 7.5);
    // Truncate title
    const titleText = g.title.length > 34 ? g.title.slice(0, 33) + "…" : g.title;
    doc.text(titleText, COL.title + 2, y + 5.5);
    setFont(doc, GRAY, 7);
    doc.text(g.thrustAreaName ?? "", COL.area + 2, y + 5.5);
    const uomShort: Record<string, string> = { numeric_min: "Num ↑", numeric_max: "Num ↓", zero: "Zero", timeline: "Date" };
    doc.text(uomShort[g.uomType] ?? g.uomType, COL.uom + 2, y + 5.5);
    doc.text(g.target, COL.target + 2, y + 5.5);
    setFont(doc, INDIGO, 7.5, "bold");
    doc.text(`${g.weightage}%`, COL.wt + 2, y + 5.5);
    setFont(doc, statusC, 7, "bold");
    doc.text(g.status.replace("_", " ").toUpperCase(), COL.score + 2, y + 5.5);

    // Draw row border
    setDraw(doc, LGRAY);
    doc.line(MARGIN, y + rowH, W - MARGIN, y + rowH);
    y += rowH;
  }

  y += 8;

  // ── QUARTERLY CHECK-INS ──────────────────────────────────────────────────
  const submitted = data.checkIns.filter(ci => ci.status === "submitted" || ci.status === "reviewed");

  if (submitted.length === 0) {
    setFont(doc, GRAY, 9);
    doc.text("No quarterly check-ins submitted yet.", MARGIN, y);
    y += 12;
  }

  for (const ci of submitted) {
    // Check if we need a new page
    const estimatedHeight = 14 + ci.goalUpdates.length * 18 + 10;
    if (y + estimatedHeight > 270) {
      doc.addPage();
      y = 20;
    }

    // Quarter header
    setFill(doc, INDIGO);
    doc.roundedRect(MARGIN, y, CONTENT_W, 10, 1.5, 1.5, "F");
    setFont(doc, WHITE, 9, "bold");
    doc.text(Q_LABEL[ci.quarter] ?? ci.quarter, MARGIN + 4, y + 7);
    if (ci.overallProgress !== null) {
      setFont(doc, WHITE, 8, "bold");
      doc.text(`Overall: ${ci.overallProgress.toFixed(1)}%`, W - MARGIN - 4, y + 7, { align: "right" });
    }
    if (ci.submittedAt) {
      setFont(doc, [176, 196, 255], 7);
      doc.text(`Submitted: ${new Date(ci.submittedAt).toLocaleDateString()}`, MARGIN + 4, y + 7);
    }
    y += 13;

    // Overall progress bar
    progressBar(doc, MARGIN, y, CONTENT_W, 3.5, ci.overallProgress);
    y += 8;

    // Per-goal updates
    for (const upd of ci.goalUpdates) {
      if (y + 18 > 270) {
        doc.addPage();
        y = 20;
      }

      const goalRowH = 16;
      setFill(doc, LIGHT);
      setDraw(doc, LGRAY);
      doc.roundedRect(MARGIN, y, CONTENT_W, goalRowH, 1, 1, "FD");

      // Goal name + thrust area
      setFont(doc, NAVY, 7.5, "bold");
      const gt = upd.goalTitle.length > 38 ? upd.goalTitle.slice(0, 37) + "…" : upd.goalTitle;
      doc.text(gt, MARGIN + 3, y + 5.5);
      setFont(doc, GRAY, 6.5);
      doc.text(upd.thrustAreaName, MARGIN + 3, y + 10);

      // Achievement vs target
      setFont(doc, GRAY, 7);
      const achLabel = upd.achievement ? `${upd.achievement} / ${upd.target}` : `— / ${upd.target}`;
      doc.text(`Achievement: ${achLabel}`, MARGIN + 70, y + 5.5);

      // Notes (truncated)
      if (upd.notes) {
        setFont(doc, GRAY, 6.5);
        const noteTrunc = upd.notes.length > 45 ? upd.notes.slice(0, 44) + "…" : upd.notes;
        doc.text(noteTrunc, MARGIN + 70, y + 11);
      }

      // Weight badge
      setFill(doc, INDIGO);
      doc.roundedRect(W - MARGIN - 38, y + 3, 14, 5.5, 1, 1, "F");
      setFont(doc, WHITE, 6.5, "bold");
      doc.text(`${upd.weightage}%`, W - MARGIN - 31, y + 7, { align: "center" });

      // Score chip
      scoreChip(doc, W - MARGIN - 10, y + 8, upd.progressScore ?? null);

      // Mini progress bar
      progressBar(doc, MARGIN + 70, y + 13, CONTENT_W - 74, 2, upd.progressScore ?? null);

      // Status dot
      const sc = STATUS_COLOUR[upd.status] ?? GRAY;
      setFill(doc, sc);
      doc.circle(MARGIN + 67, y + 7, 2.5, "F");

      y += goalRowH + 2;
    }

    y += 6;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setFill(doc, NAVY);
    doc.rect(0, 287, W, 10, "F");
    setFont(doc, [148, 163, 200], 7);
    doc.text("AtomQuest Goal Tracker  ·  ATOMQUEST HACKATHON 1.0  ·  CONFIDENTIAL", MARGIN, 293);
    doc.text(`Page ${p} of ${totalPages}`, W - MARGIN, 293, { align: "right" });
  }

  const filename = `scorecard_${data.employeeName.replace(/\s+/g, "_")}_${data.cycleName.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
