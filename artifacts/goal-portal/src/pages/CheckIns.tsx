import { useEffect, useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface GoalForCheckIn {
  id: number;
  title: string;
  uomType: string;
  uomUnit: string;
  target: string;
  weightage: number;
  thrustAreaName?: string;
}
interface GoalUpdate {
  goalId: number;
  achievement: string;
  status: "not_started" | "on_track" | "completed" | "at_risk";
  notes: string;
  progressScore?: number | null;
}
interface CheckIn {
  id: number;
  quarter: string;
  status: string;
  overallProgress: number | null;
  submittedAt: string | null;
  goalUpdates?: GoalUpdate[];
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const QUARTER_LABELS: Record<string, string> = {
  Q1: "Q1 (Jul–Sep)",
  Q2: "Q2 (Oct–Dec)",
  Q3: "Q3 (Jan–Mar)",
  Q4: "Q4 (Apr–Jun)",
};

const STATUS_OPTS = [
  { value: "not_started", label: "Not Started", color: "text-gray-500" },
  { value: "on_track", label: "On Track", color: "text-blue-600" },
  { value: "completed", label: "Completed", color: "text-green-600" },
  { value: "at_risk", label: "At Risk", color: "text-red-500" },
];

function computeScore(goal: GoalForCheckIn, achievement: string): number | null {
  if (!achievement && achievement !== "0") return null;
  const target = parseFloat(goal.target);
  const ach = parseFloat(achievement);
  if (goal.uomType === "zero") return achievement === "0" ? 100 : 0;
  if (goal.uomType === "numeric_min") return isNaN(target) || target === 0 ? null : Math.min((ach / target) * 100, 100);
  if (goal.uomType === "numeric_max") return isNaN(target) || ach === 0 ? null : Math.min((target / ach) * 100, 100);
  return null;
}

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  reviewed: "bg-green-100 text-green-800",
  pending: "bg-gray-100 text-gray-600",
  in_progress: "bg-yellow-100 text-yellow-800",
};

export default function CheckIns({ user }: { user: AuthUser }) {
  const [checkIns, setCheckIns] = useState<Record<string, CheckIn | null>>({});
  const [goalSheet, setGoalSheet] = useState<{ id: number; goals: GoalForCheckIn[] } | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [updates, setUpdates] = useState<Record<number, GoalUpdate>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const headers = getUserHeader(user);
  const isManagerOrAdmin = user.role === "manager" || user.role === "admin";

  // For manager/admin: team check-ins
  const [teamCheckIns, setTeamCheckIns] = useState<Array<{
    employeeName: string; employeeId: number; quarter: string; status: string; progress: number | null;
  }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (isManagerOrAdmin) {
      const res = await fetch(`/api/check-ins`, { headers });
      const data = await res.json();
      setTeamCheckIns(Array.isArray(data) ? data.map((ci: CheckIn & { employeeName?: string; employeeId?: number }) => ({
        employeeName: ci.employeeName ?? `Employee #${ci.employeeId}`,
        employeeId: ci.employeeId ?? 0,
        quarter: ci.quarter,
        status: ci.status,
        progress: ci.overallProgress,
      })) : []);
    } else {
      // Load employee's goal sheet
      const sheetRes = await fetch(`/api/goal-sheets?employeeId=${user.id}`, { headers });
      const sheets = await sheetRes.json();
      if (Array.isArray(sheets) && sheets.length > 0) {
        const detail = await fetch(`/api/goal-sheets/${sheets[0].id}`, { headers }).then(r => r.json());
        setGoalSheet({ id: detail.id, goals: detail.goals ?? [] });

        // Load check-ins for each quarter
        const ciRes = await fetch(`/api/check-ins?goalSheetId=${detail.id}`, { headers });
        const ciData = await ciRes.json();
        const ciMap: Record<string, CheckIn | null> = {};
        for (const q of QUARTERS) ciMap[q] = null;
        if (Array.isArray(ciData)) {
          for (const ci of ciData) ciMap[ci.quarter] = ci;
        }
        setCheckIns(ciMap);
      }
    }
  }

  async function startCheckIn(quarter: string) {
    if (!goalSheet) return;
    setLoading(true);
    try {
      const res = await fetch("/api/check-ins", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ goalSheetId: goalSheet.id, cycleId: 1, quarter }),
      });
      const data = await res.json();
      setCheckIns(prev => ({ ...prev, [quarter]: data }));
      // Init updates from goals
      const updMap: Record<number, GoalUpdate> = {};
      for (const g of goalSheet.goals) {
        updMap[g.id] = { goalId: g.id, achievement: "", status: "not_started", notes: "" };
      }
      setUpdates(updMap);
      setSelectedQuarter(quarter);
      toast({ title: `${quarter} check-in started` });
    } catch {
      toast({ title: "Error starting check-in", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function submitCheckIn() {
    const ci = checkIns[selectedQuarter];
    if (!ci) return;
    setLoading(true);
    try {
      // Save goal updates
      for (const upd of Object.values(updates)) {
        const score = goalSheet?.goals.find(g => g.id === upd.goalId)
          ? computeScore(goalSheet.goals.find(g => g.id === upd.goalId)!, upd.achievement)
          : null;
        await fetch(`/api/check-ins/${ci.id}/goal-updates`, {
          method: "POST", headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ ...upd, progressScore: score }),
        });
      }
      // Submit check-in
      await fetch(`/api/check-ins/${ci.id}/submit`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}",
      });
      await loadData();
      toast({ title: `${selectedQuarter} check-in submitted!` });
    } catch {
      toast({ title: "Error submitting check-in", variant: "destructive" });
    } finally { setLoading(false); }
  }

  function updateField(goalId: number, field: keyof GoalUpdate, value: string) {
    setUpdates(prev => ({ ...prev, [goalId]: { ...prev[goalId], goalId, [field]: value } }));
  }

  const currentCI = checkIns[selectedQuarter];

  if (isManagerOrAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Team Check-ins</h1>
        {teamCheckIns.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center text-muted-foreground">
            No check-ins submitted yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quarter</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Progress Score</th>
                </tr>
              </thead>
              <tbody>
                {teamCheckIns.map((ci, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{ci.employeeName}</td>
                    <td className="px-4 py-3">{QUARTER_LABELS[ci.quarter] ?? ci.quarter}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[ci.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {ci.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {ci.progress !== null && ci.progress !== undefined ? `${ci.progress.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (!goalSheet) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Quarterly Check-ins</h1>
        <div className="bg-white border border-border rounded-xl p-12 text-center text-muted-foreground">
          You need an approved goal sheet before submitting check-ins.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Quarterly Check-ins</h1>
      <p className="text-sm text-muted-foreground mb-6">Report your progress for each quarter against your approved goals.</p>

      {/* Quarter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {QUARTERS.map(q => {
          const ci = checkIns[q];
          return (
            <button key={q} onClick={() => setSelectedQuarter(q)}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                selectedQuarter === q ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border hover:border-primary/50")}>
              {QUARTER_LABELS[q]}
              {ci && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${STATUS_BADGE[ci.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {ci.status}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Check-in panel */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{QUARTER_LABELS[selectedQuarter]} Self-Assessment</h2>
            {currentCI && <p className="text-xs text-muted-foreground">Status: <span className="capitalize">{currentCI.status}</span>
              {currentCI.overallProgress !== null && ` · Score: ${currentCI.overallProgress?.toFixed(1)}%`}</p>}
          </div>
          {!currentCI && (
            <Button size="sm" onClick={() => startCheckIn(selectedQuarter)} disabled={loading}>
              Start Check-in
            </Button>
          )}
          {currentCI?.status === "in_progress" && (
            <Button size="sm" onClick={submitCheckIn} disabled={loading}>Submit Check-in</Button>
          )}
        </div>

        {!currentCI ? (
          <div className="p-12 text-center text-muted-foreground">
            Click "Start Check-in" to begin your {selectedQuarter} self-assessment.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {goalSheet.goals.map(goal => {
              const upd = updates[goal.id] ?? { goalId: goal.id, achievement: "", status: "not_started", notes: "" };
              const score = upd.achievement !== "" ? computeScore(goal, upd.achievement) : null;
              const isLocked = currentCI.status === "submitted" || currentCI.status === "reviewed";

              return (
                <div key={goal.id} className="p-5">
                  <div className="flex items-start justify-between mb-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium">{goal.title}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{goal.weightage}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Target: {goal.target} {goal.uomUnit} · {goal.uomType.replace("_", " ")}</p>
                    </div>
                    {score !== null && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-primary">{score.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">score</div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Achievement</Label>
                      <Input className="h-8 text-sm" value={upd.achievement}
                        disabled={isLocked}
                        placeholder={goal.uomType === "timeline" ? "YYYY-MM-DD" : "actual value"}
                        onChange={e => updateField(goal.id, "achievement", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <select className="w-full h-8 border border-input rounded-md px-2 text-sm bg-background disabled:opacity-60"
                        value={upd.status} disabled={isLocked}
                        onChange={e => updateField(goal.id, "status", e.target.value)}>
                        {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes / Comments</Label>
                      <Input className="h-8 text-sm" value={upd.notes} disabled={isLocked}
                        placeholder="Optional notes…"
                        onChange={e => updateField(goal.id, "notes", e.target.value)} />
                    </div>
                  </div>

                  {score !== null && (
                    <Progress value={score} className="h-1.5 mt-3" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
