import { useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";
import { generateScorecard, type ScorecardInput } from "@/lib/scorecard-pdf";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface CheckInData {
  id: number;
  quarter: string;
  status: string;
  overallProgress: number | null;
  submittedAt: string | null;
  goalUpdates: Array<{
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
  }>;
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

const Q_LABEL: Record<string, string> = {
  Q1: "Q1 (Jul–Sep)",
  Q2: "Q2 (Oct–Dec)",
  Q3: "Q3 (Jan–Mar)",
  Q4: "Q4 (Apr–Jun)",
};

const STATUS_BADGE: Record<string, string> = {
  on_track: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  at_risk: "bg-amber-100 text-amber-800",
  not_started: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-800",
  reviewed: "bg-green-100 text-green-800",
};

export default function Scorecard({ user }: { user: AuthUser }) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [checkIns, setCheckIns] = useState<CheckInData[]>([]);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [sheetInfo, setSheetInfo] = useState<{ status: string; cycleName: string; submittedAt: string | null; approvedAt: string | null } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();
  const headers = getUserHeader(user);

  async function loadData() {
    setLoading(true);
    try {
      // Get goal sheet
      const sheetRes = await fetch(`/api/goal-sheets?employeeId=${user.id}`, { headers });
      const sheets = await sheetRes.json();
      if (!Array.isArray(sheets) || sheets.length === 0) {
        toast({ title: "No goal sheet found", description: "You need an approved goal sheet first.", variant: "destructive" });
        setLoading(false);
        return;
      }
      const sheet = sheets[0];
      setSheetInfo({ status: sheet.status, cycleName: sheet.cycleName, submittedAt: sheet.submittedAt, approvedAt: sheet.approvedAt });

      // Get full sheet details (goals)
      const detailRes = await fetch(`/api/goal-sheets/${sheet.id}`, { headers });
      const detail = await detailRes.json();
      setGoals(detail.goals ?? []);

      // Get all check-ins with their goal updates
      const ciRes = await fetch(`/api/check-ins?goalSheetId=${sheet.id}`, { headers });
      const ciList = await ciRes.json();

      const detailedCIs: CheckInData[] = await Promise.all(
        (Array.isArray(ciList) ? ciList : []).map(async (ci: { id: number }) => {
          const r = await fetch(`/api/check-ins/${ci.id}`, { headers });
          return r.json();
        })
      );
      setCheckIns(detailedCIs);
      setLoaded(true);
    } catch {
      toast({ title: "Error loading scorecard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setGenerating(true);
    try {
      const input: ScorecardInput = {
        employeeName: user.name,
        email: user.email,
        department: user.department,
        designation: user.designation ?? null,
        managerName: user.managerName ?? null,
        cycleName: sheetInfo?.cycleName ?? "FY 2025-26",
        sheetStatus: sheetInfo?.status ?? "draft",
        submittedAt: sheetInfo?.submittedAt ?? null,
        approvedAt: sheetInfo?.approvedAt ?? null,
        goals,
        checkIns,
        generatedOn: new Date().toLocaleString(),
      };
      generateScorecard(input);
      toast({ title: "Scorecard downloaded!", description: "Check your Downloads folder." });
    } catch (e) {
      toast({ title: "PDF generation failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  // Compute weighted final score
  function finalScore(): number | null {
    const goalMap = new Map(goals.map(g => [g.id, g]));
    const submitted = checkIns.filter(ci => ci.status === "submitted" || ci.status === "reviewed");
    const goalScores: Record<number, number[]> = {};
    for (const ci of submitted) {
      for (const upd of ci.goalUpdates) {
        if (upd.progressScore === null || upd.progressScore === undefined) continue;
        if (!goalScores[upd.goalId]) goalScores[upd.goalId] = [];
        goalScores[upd.goalId].push(upd.progressScore);
      }
    }
    let tw = 0, ts = 0;
    for (const [gidStr, scores] of Object.entries(goalScores)) {
      const g = goals.find(x => x.id === Number(gidStr));
      if (!g || scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      ts += avg * g.weightage;
      tw += g.weightage;
    }
    return tw > 0 ? ts / tw : null;
  }

  const fs = loaded ? finalScore() : null;
  const fsColour = fs === null ? "text-muted-foreground" : fs >= 80 ? "text-green-600" : fs >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Scorecard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Individual goal achievement report with per-quarter progress breakdown.
          </p>
        </div>
        <div className="flex gap-2">
          {!loaded && (
            <Button onClick={loadData} disabled={loading}>
              {loading ? "Loading…" : "Load Scorecard"}
            </Button>
          )}
          {loaded && (
            <Button onClick={handleDownload} disabled={generating} className="gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {generating ? "Generating…" : "Download PDF"}
            </Button>
          )}
        </div>
      </div>

      {!loaded && !loading && (
        <div className="bg-white border border-border rounded-xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-1">Individual Scorecard</h3>
          <p className="text-muted-foreground text-sm mb-5 max-w-sm mx-auto">
            Click "Load Scorecard" to preview your goal achievement data across all quarters, then download as a professional PDF.
          </p>
          <Button onClick={loadData} disabled={loading} size="lg">Load Scorecard</Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading your scorecard data…
        </div>
      )}

      {loaded && (
        <div className="space-y-5">
          {/* Employee card */}
          <div className="bg-[hsl(222,47%,13%)] rounded-xl p-5 flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-[hsl(230,76%,55%)] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1">
              <h2 className="text-white text-xl font-bold">{user.name}</h2>
              <p className="text-[hsl(220,20%,65%)] text-sm">{user.designation} · {user.department}</p>
              <p className="text-[hsl(220,20%,55%)] text-xs mt-0.5">{user.email}</p>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${fsColour === "text-muted-foreground" ? "text-[hsl(220,20%,55%)]" : fsColour.replace("text-", "text-")}`}>
                {fs !== null ? `${fs.toFixed(1)}%` : "—"}
              </div>
              <div className="text-[hsl(220,20%,55%)] text-xs mt-0.5">Weighted Final Score</div>
              {sheetInfo && (
                <span className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                  sheetInfo.status === "approved" ? "bg-green-100 text-green-800" :
                  sheetInfo.status === "submitted" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
                }`}>{sheetInfo.status}</span>
              )}
            </div>
          </div>

          {/* Goals table */}
          {goals.length > 0 && (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Approved Goals — {sheetInfo?.cycleName}</h3>
                <span className="text-xs text-muted-foreground">{goals.length} goal{goals.length !== 1 ? "s" : ""}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs">Goal</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Thrust Area</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Target</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Weight</th>
                    <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map(g => (
                    <tr key={g.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5 font-medium">{g.title}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{g.thrustAreaName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{g.target} {g.uomUnit}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-primary">{g.weightage}%</td>
                      <td className="px-5 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[g.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {g.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Check-ins */}
          {checkIns.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              No check-ins submitted yet. Submit your quarterly check-ins to see progress here.
            </div>
          ) : (
            checkIns.map(ci => (
              <div key={ci.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-[hsl(230,76%,55%)] text-white">
                  <div>
                    <span className="font-bold">{Q_LABEL[ci.quarter] ?? ci.quarter}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[ci.status] ?? "bg-white/20 text-white"}`}>
                      {ci.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold">
                      {ci.overallProgress !== null ? `${ci.overallProgress.toFixed(1)}%` : "—"}
                    </span>
                    <span className="text-xs opacity-70 ml-1">overall</span>
                  </div>
                </div>

                {ci.overallProgress !== null && (
                  <Progress value={ci.overallProgress} className="h-1.5 rounded-none" />
                )}

                {ci.goalUpdates.length > 0 ? (
                  <div className="divide-y divide-border">
                    {ci.goalUpdates.map(upd => (
                      <div key={upd.goalId} className="px-5 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{upd.goalTitle}</div>
                          <div className="text-xs text-muted-foreground">
                            {upd.thrustAreaName} · Achievement: <span className="font-medium">{upd.achievement || "—"}</span> / Target: {upd.target}
                            {upd.notes && <span className="ml-2 text-muted-foreground italic">"{upd.notes}"</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[upd.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {upd.status.replace("_", " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">{upd.weightage}% weight</span>
                          <span className={`text-sm font-bold w-14 text-right ${
                            upd.progressScore === null ? "text-muted-foreground" :
                            upd.progressScore >= 80 ? "text-green-600" :
                            upd.progressScore >= 50 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {upd.progressScore !== null ? `${upd.progressScore.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-4 text-sm text-muted-foreground">No goal updates for this quarter.</div>
                )}
              </div>
            ))
          )}

          {/* Download CTA */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">Ready to export?</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Generate a professional PDF scorecard with your complete goal achievement record.</p>
            </div>
            <Button onClick={handleDownload} disabled={generating} size="lg" className="gap-2 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {generating ? "Generating PDF…" : "Download Scorecard PDF"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
