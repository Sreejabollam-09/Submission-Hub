import { useEffect, useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ThrustArea { id: number; name: string; description: string | null; }
interface Goal {
  id?: number;
  thrustAreaId: number;
  title: string;
  description: string;
  uomType: "numeric_min" | "numeric_max" | "zero" | "timeline";
  uomUnit: string;
  target: string;
  weightage: number;
  status?: string;
}
interface GoalSheet {
  id: number;
  employeeId: number;
  employeeName?: string;
  employeeDepartment?: string;
  cycleId: number;
  status: string;
  isLocked: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  goals?: GoalFromApi[];
}
interface GoalFromApi {
  id: number;
  thrustAreaId: number;
  thrustAreaName?: string;
  title: string;
  description: string | null;
  uomType: string;
  uomUnit: string;
  target: string;
  weightage: number;
  status: string;
}

const UOM_LABELS: Record<string, string> = {
  numeric_min: "Numeric (Higher is better)",
  numeric_max: "Numeric (Lower is better)",
  zero: "Zero-incident (must be 0)",
  timeline: "Timeline / Date",
};

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-800 border-green-200",
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  returned: "bg-red-100 text-red-700 border-red-200",
};

function emptyGoal(): Goal {
  return { thrustAreaId: 0, title: "", description: "", uomType: "numeric_min", uomUnit: "", target: "", weightage: 10 };
}

function totalWeightage(goals: Goal[]) {
  return goals.reduce((s, g) => s + (Number(g.weightage) || 0), 0);
}

export default function GoalSheets({ user }: { user: AuthUser }) {
  const [sheets, setSheets] = useState<GoalSheet[]>([]);
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<GoalSheet | null>(null);
  const [goals, setGoals] = useState<Goal[]>([emptyGoal()]);
  const [editingGoalIdx, setEditingGoalIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [showReturn, setShowReturn] = useState(false);
  const { toast } = useToast();
  const headers = getUserHeader(user);

  const isManagerOrAdmin = user.role === "manager" || user.role === "admin";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [areasRes, sheetsRes] = await Promise.all([
      fetch("/api/thrust-areas", { headers }),
      fetch(`/api/goal-sheets${isManagerOrAdmin ? "" : `?employeeId=${user.id}`}`, { headers }),
    ]);
    const [areas, sheetsData] = await Promise.all([areasRes.json(), sheetsRes.json()]);
    setThrustAreas(Array.isArray(areas) ? areas : []);
    const sheetArr = Array.isArray(sheetsData) ? sheetsData : [];
    setSheets(sheetArr);
    if (!isManagerOrAdmin && sheetArr.length > 0) {
      openSheet(sheetArr[0]);
    }
  }

  async function openSheet(sheet: GoalSheet) {
    const res = await fetch(`/api/goal-sheets/${sheet.id}`, { headers });
    const data = await res.json();
    setSelectedSheet(data);
    const apiGoals: GoalFromApi[] = data.goals ?? [];
    setGoals(apiGoals.length > 0 ? apiGoals.map(g => ({
      id: g.id, thrustAreaId: g.thrustAreaId, title: g.title, description: g.description ?? "",
      uomType: g.uomType as Goal["uomType"], uomUnit: g.uomUnit, target: g.target, weightage: g.weightage, status: g.status,
    })) : [emptyGoal()]);
    setEditingGoalIdx(null);
  }

  async function createSheet() {
    setLoading(true);
    try {
      const res = await fetch("/api/goal-sheets", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId: 1 }),
      });
      const data = await res.json();
      await loadData();
      await openSheet(data);
      toast({ title: "Goal sheet created!" });
    } catch {
      toast({ title: "Error creating sheet", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function saveGoal(idx: number) {
    const g = goals[idx];
    if (!g.title || !g.thrustAreaId || !g.target || !g.uomUnit) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const body = { ...g, goalSheetId: selectedSheet!.id };
      if (g.id) {
        await fetch(`/api/goals/${g.id}`, {
          method: "PUT", headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch("/api/goals", {
          method: "POST", headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setGoals(prev => prev.map((x, i) => i === idx ? { ...x, id: data.id } : x));
      }
      setEditingGoalIdx(null);
      toast({ title: "Goal saved" });
      await openSheet(selectedSheet!);
    } catch {
      toast({ title: "Error saving goal", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function deleteGoal(idx: number) {
    const g = goals[idx];
    if (g.id) {
      await fetch(`/api/goals/${g.id}`, { method: "DELETE", headers });
    }
    setGoals(prev => prev.filter((_, i) => i !== idx));
    if (editingGoalIdx === idx) setEditingGoalIdx(null);
  }

  async function submitSheet() {
    const total = totalWeightage(goals);
    if (total !== 100) {
      toast({ title: `Weightage must total 100% (currently ${total}%)`, variant: "destructive" }); return;
    }
    if (goals.length < 1) {
      toast({ title: "Add at least 1 goal", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/goal-sheets/${selectedSheet!.id}/submit`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}",
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await loadData();
      toast({ title: "Goal sheet submitted for approval!" });
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function approveSheet() {
    setLoading(true);
    try {
      await fetch(`/api/goal-sheets/${selectedSheet!.id}/approve`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}",
      });
      await loadData();
      toast({ title: "Goal sheet approved!" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function returnSheet() {
    setLoading(true);
    try {
      await fetch(`/api/goal-sheets/${selectedSheet!.id}/return`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: returnComment }),
      });
      setShowReturn(false);
      setReturnComment("");
      await loadData();
      toast({ title: "Sheet returned for revision" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const isLocked = selectedSheet?.isLocked || ["approved", "submitted"].includes(selectedSheet?.status ?? "");
  const canEdit = !isManagerOrAdmin && !isLocked;
  const weightTotal = totalWeightage(goals);

  if (isManagerOrAdmin && !selectedSheet) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Team Goal Sheets</h1>
        {sheets.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center text-muted-foreground">
            No goal sheets found.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sheets.map(s => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{s.employeeName ?? `Employee #${s.employeeId}`}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.employeeDepartment ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border text-xs font-medium capitalize ${STATUS_STYLES[s.status] ?? STATUS_STYLES.draft}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openSheet(s)}>Review</Button>
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isManagerOrAdmin ? `Goal Sheet — ${selectedSheet?.employeeName ?? ""}` : "My Goal Sheet"}
          </h1>
          {selectedSheet && (
            <p className="text-sm text-muted-foreground mt-0.5">
              FY 2025-26 · {goals.length} goal{goals.length !== 1 ? "s" : ""} · Weightage: <span className={weightTotal === 100 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>{weightTotal}%</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedSheet(null)}>← All Sheets</Button>
          )}
          {selectedSheet && (
            <span className={`px-3 py-1 rounded-full border text-xs font-semibold capitalize ${STATUS_STYLES[selectedSheet.status] ?? STATUS_STYLES.draft}`}>
              {selectedSheet.status}
            </span>
          )}
        </div>
      </div>

      {/* No sheet yet — employee */}
      {!selectedSheet && !isManagerOrAdmin && (
        <div className="bg-white border border-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-1">No goal sheet yet</h3>
          <p className="text-muted-foreground text-sm mb-5">Create your goal sheet for FY 2025-26</p>
          <Button onClick={createSheet} disabled={loading}>Create Goal Sheet</Button>
        </div>
      )}

      {/* Goal sheet detail */}
      {selectedSheet && (
        <div className="space-y-4">
          {/* Goals list */}
          {goals.map((g, idx) => (
            <div key={idx} className={cn("bg-white border rounded-xl shadow-sm overflow-hidden", editingGoalIdx === idx ? "border-primary" : "border-border")}>
              {editingGoalIdx === idx ? (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <Label>Goal Title *</Label>
                      <Input value={g.title} onChange={e => updateGoal(idx, "title", e.target.value)} placeholder="e.g. Achieve Q3 Revenue Target" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Thrust Area *</Label>
                      <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={g.thrustAreaId}
                        onChange={e => updateGoal(idx, "thrustAreaId", Number(e.target.value))}>
                        <option value={0}>Select thrust area…</option>
                        {thrustAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit of Measurement *</Label>
                      <select className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={g.uomType}
                        onChange={e => updateGoal(idx, "uomType", e.target.value as Goal["uomType"])}>
                        {Object.entries(UOM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit Name * <span className="text-xs text-muted-foreground">(e.g. INR Lakhs, %)</span></Label>
                      <Input value={g.uomUnit} onChange={e => updateGoal(idx, "uomUnit", e.target.value)} placeholder="e.g. INR Lakhs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Target *</Label>
                      <Input value={g.target} onChange={e => updateGoal(idx, "target", e.target.value)}
                        placeholder={g.uomType === "timeline" ? "YYYY-MM-DD" : "e.g. 50"} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Description</Label>
                      <Input value={g.description} onChange={e => updateGoal(idx, "description", e.target.value)} placeholder="Brief description of the goal" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Weightage (%) * <span className="text-xs text-muted-foreground">min 10%</span></Label>
                      <Input type="number" min={10} max={100} value={g.weightage}
                        onChange={e => updateGoal(idx, "weightage", Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => saveGoal(idx)} disabled={loading}>Save Goal</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingGoalIdx(null)}>Cancel</Button>
                    {!g.id && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteGoal(idx)}>Remove</Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center px-5 py-4 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-foreground">{g.title || <span className="text-muted-foreground italic">Untitled goal</span>}</span>
                      {g.thrustAreaId > 0 && (
                        <span className="px-1.5 py-0.5 bg-accent text-accent-foreground rounded text-xs">
                          {thrustAreas.find(a => a.id === g.thrustAreaId)?.name ?? ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {UOM_LABELS[g.uomType]} · Target: {g.target} {g.uomUnit} · {g.description}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-primary">{g.weightage}%</div>
                    <div className="text-xs text-muted-foreground">weight</div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setEditingGoalIdx(idx)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteGoal(idx)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add goal button */}
          {canEdit && goals.length < 8 && (
            <button onClick={() => { setGoals(prev => [...prev, emptyGoal()]); setEditingGoalIdx(goals.length); }}
              className="w-full border-2 border-dashed border-border rounded-xl py-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Goal {goals.length > 0 ? `(${goals.length}/8)` : ""}
            </button>
          )}

          {/* Summary bar */}
          <div className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Goals: </span>
                <span className="font-semibold">{goals.length}/8</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Weightage: </span>
                <span className={`font-semibold ${weightTotal === 100 ? "text-green-600" : "text-red-500"}`}>{weightTotal}%</span>
                {weightTotal !== 100 && <span className="text-xs text-muted-foreground ml-1">(must be 100%)</span>}
              </div>
            </div>

            <div className="flex gap-2">
              {/* Employee actions */}
              {!isManagerOrAdmin && selectedSheet.status === "draft" && (
                <Button onClick={submitSheet} disabled={loading || weightTotal !== 100}>
                  Submit for Approval
                </Button>
              )}
              {!isManagerOrAdmin && selectedSheet.status === "returned" && (
                <Button onClick={submitSheet} disabled={loading || weightTotal !== 100}>
                  Resubmit
                </Button>
              )}

              {/* Manager/Admin actions */}
              {isManagerOrAdmin && selectedSheet.status === "submitted" && (
                <>
                  <Button variant="outline" onClick={() => setShowReturn(true)}>Return for Revision</Button>
                  <Button onClick={approveSheet} disabled={loading}>Approve</Button>
                </>
              )}
            </div>
          </div>

          {/* Return dialog */}
          {showReturn && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="font-semibold text-lg mb-3">Return for Revision</h3>
                <p className="text-sm text-muted-foreground mb-4">Provide a reason to help the employee improve their goal sheet.</p>
                <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Goals need more specificity in targets…" value={returnComment}
                  onChange={e => setReturnComment(e.target.value)} />
                <div className="flex gap-2 mt-4 justify-end">
                  <Button variant="ghost" onClick={() => setShowReturn(false)}>Cancel</Button>
                  <Button onClick={returnSheet} disabled={loading}>Return Sheet</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function updateGoal(idx: number, field: keyof Goal, value: string | number) {
    setGoals(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  }
}
