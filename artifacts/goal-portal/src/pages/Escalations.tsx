import { useEffect, useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface EscalationRule {
  id: number;
  name: string;
  triggerType: "no_submission" | "no_approval" | "no_checkin";
  thresholdDays: number;
  active: boolean;
}

interface EscalationLog {
  id: number;
  ruleId: number;
  ruleName: string;
  triggerType: string;
  userId: number;
  userName: string;
  userEmail: string;
  cycleId: number;
  escalationLevel: "employee" | "manager" | "hr";
  reason: string;
  status: "open" | "resolved";
  resolvedAt: string | null;
  createdAt: string;
}

const TRIGGER_LABEL: Record<string, string> = {
  no_submission: "Goal not submitted",
  no_approval:   "Goal not approved",
  no_checkin:    "Check-in overdue",
};

const LEVEL_BADGE: Record<string, string> = {
  employee: "bg-blue-100 text-blue-800",
  manager:  "bg-amber-100 text-amber-800",
  hr:       "bg-red-100 text-red-800",
};

const STATUS_BADGE: Record<string, string> = {
  open:     "bg-red-100 text-red-800",
  resolved: "bg-green-100 text-green-800",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Escalations({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState<"logs" | "rules">("logs");
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [logs, setLogs] = useState<EscalationLog[]>([]);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ results: { rule: string; triggered: number; notifications: number }[]; message: string } | null>(null);
  const [newRule, setNewRule] = useState({ name: "", triggerType: "no_submission", thresholdDays: "7" });
  const [showAdd, setShowAdd] = useState(false);
  const { toast } = useToast();
  const headers = getUserHeader(user);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [r, l] = await Promise.all([
      fetch("/api/escalations/rules", { headers }).then(r => r.json()),
      fetch("/api/escalations/logs", { headers }).then(r => r.json()),
    ]);
    setRules(Array.isArray(r) ? r : []);
    setLogs(Array.isArray(l) ? l : []);
  }

  async function runEscalation() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/escalations/run", { method: "POST", headers });
      const data = await res.json();
      setRunResult(data);
      await loadAll();
      toast({ title: "Escalation check complete", description: data.message });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  async function toggleRule(rule: EscalationRule) {
    await fetch(`/api/escalations/rules/${rule.id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    setRules(rs => rs.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
  }

  async function updateThreshold(rule: EscalationRule, days: number) {
    await fetch(`/api/escalations/rules/${rule.id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ thresholdDays: days }),
    });
    setRules(rs => rs.map(r => r.id === rule.id ? { ...r, thresholdDays: days } : r));
  }

  async function deleteRule(id: number) {
    await fetch(`/api/escalations/rules/${id}`, { method: "DELETE", headers });
    setRules(rs => rs.filter(r => r.id !== id));
  }

  async function addRule() {
    if (!newRule.name || !newRule.thresholdDays) return;
    const res = await fetch("/api/escalations/rules", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ...newRule, thresholdDays: Number(newRule.thresholdDays) }),
    });
    const r = await res.json();
    setRules(rs => [...rs, r]);
    setNewRule({ name: "", triggerType: "no_submission", thresholdDays: "7" });
    setShowAdd(false);
    toast({ title: "Rule added" });
  }

  async function resolveLog(id: number) {
    await fetch(`/api/escalations/logs/${id}/resolve`, { method: "PATCH", headers });
    setLogs(ls => ls.map(l => l.id === id ? { ...l, status: "resolved" as const, resolvedAt: new Date().toISOString() } : l));
    toast({ title: "Escalation resolved" });
  }

  const openLogs = logs.filter(l => l.status === "open");
  const resolvedLogs = logs.filter(l => l.status === "resolved");

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Escalation Module</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Rule-based escalation engine — auto-notifies employees, managers, and HR when action is overdue.</p>
        </div>
        <Button onClick={runEscalation} disabled={running} className="gap-2 flex-shrink-0">
          <svg className={`w-4 h-4 ${running ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {running ? "Running…" : "Run Escalation Check"}
        </Button>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-semibold text-green-800 text-sm">{runResult.message}</p>
          {runResult.results.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-2">
              {runResult.results.map((r, i) => (
                <span key={i} className="px-3 py-1 bg-white border border-green-200 rounded-full text-xs text-green-700">
                  <strong>{r.rule}</strong>: {r.triggered} escalations, {r.notifications} notifications
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Active Rules", value: rules.filter(r => r.active).length, icon: "⚙️", colour: "bg-blue-50 border-blue-200" },
          { label: "Open Escalations", value: openLogs.length, icon: "🚨", colour: openLogs.length > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200" },
          { label: "Resolved", value: resolvedLogs.length, icon: "✅", colour: "bg-green-50 border-green-200" },
        ].map(s => (
          <div key={s.label} className={`${s.colour} border rounded-xl p-4 flex items-center gap-3`}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-muted/40 rounded-lg p-1 w-fit">
        {(["logs", "rules"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "logs" ? `Escalation Log ${logs.length > 0 ? `(${logs.length})` : ""}` : "Rules & Configuration"}
          </button>
        ))}
      </div>

      {tab === "logs" && (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="font-semibold">No escalations yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Run the escalation check to evaluate all active rules against current cycle data.</p>
            </div>
          ) : (
            <>
              {openLogs.length > 0 && (
                <>
                  <h3 className="font-semibold text-sm text-red-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    Open Escalations ({openLogs.length})
                  </h3>
                  {openLogs.map(log => (
                    <EscalationLogRow key={log.id} log={log} onResolve={() => resolveLog(log.id)} />
                  ))}
                  <div className="border-t border-border pt-3" />
                </>
              )}
              {resolvedLogs.length > 0 && (
                <>
                  <h3 className="font-semibold text-sm text-green-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Resolved ({resolvedLogs.length})
                  </h3>
                  {resolvedLogs.map(log => (
                    <EscalationLogRow key={log.id} log={log} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === "rules" && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Configured Rules</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(s => !s)} className="gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Rule
              </Button>
            </div>

            {showAdd && (
              <div className="px-5 py-4 bg-blue-50 border-b border-border flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-48">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Rule Name</label>
                  <Input value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} placeholder="e.g. Check-in overdue reminder" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Trigger</label>
                  <select value={newRule.triggerType} onChange={e => setNewRule(r => ({ ...r, triggerType: e.target.value }))}
                    className="h-8 text-sm px-2 border border-input rounded-md bg-white">
                    <option value="no_submission">Goal not submitted</option>
                    <option value="no_approval">Goal not approved</option>
                    <option value="no_checkin">Check-in overdue</option>
                  </select>
                </div>
                <div className="w-24">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Days</label>
                  <Input type="number" min="1" value={newRule.thresholdDays} onChange={e => setNewRule(r => ({ ...r, thresholdDays: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addRule}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {rules.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No rules configured yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {rules.map(rule => (
                  <div key={rule.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rule.name}</span>
                        <span className="px-2 py-0.5 bg-muted text-xs rounded-full text-muted-foreground">
                          {TRIGGER_LABEL[rule.triggerType] ?? rule.triggerType}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Trigger after <strong>{rule.thresholdDays} days</strong> · {rule.active ? "Active" : "Paused"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Days:</label>
                        <Input
                          type="number" min="1" defaultValue={rule.thresholdDays}
                          className="w-16 h-7 text-xs"
                          onBlur={e => { const v = Number(e.target.value); if (v !== rule.thresholdDays && v > 0) updateThreshold(rule, v); }}
                        />
                      </div>
                      <button onClick={() => toggleRule(rule)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${rule.active ? "bg-green-500" : "bg-gray-300"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${rule.active ? "left-5" : "left-0.5"}`} />
                      </button>
                      <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-white border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3 text-sm">How the Escalation Engine Works</h3>
            <div className="space-y-3">
              {[
                { icon: "1️⃣", title: "Configure Rules", desc: "Set trigger conditions (no submission, no approval, overdue check-in) with a threshold in days." },
                { icon: "2️⃣", title: "Run Check", desc: "Click 'Run Escalation Check' to evaluate all active rules against current cycle data." },
                { icon: "3️⃣", title: "Auto-Notify", desc: "Non-compliant employees and their managers receive in-app, email, and Teams notifications automatically." },
                { icon: "4️⃣", title: "Track & Resolve", desc: "View all escalation events in the log. Mark them resolved once the action has been taken." },
              ].map(step => (
                <div key={step.title} className="flex items-start gap-3">
                  <span className="text-lg">{step.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EscalationLogRow({ log, onResolve }: { log: EscalationLog; onResolve?: () => void }) {
  function timeAgo(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  }
  const LEVEL_BADGE: Record<string, string> = {
    employee: "bg-blue-100 text-blue-800",
    manager: "bg-amber-100 text-amber-800",
    hr: "bg-red-100 text-red-800",
  };
  const STATUS_BADGE: Record<string, string> = {
    open: "bg-red-100 text-red-800",
    resolved: "bg-green-100 text-green-800",
  };
  return (
    <div className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${log.status === "open" ? "border-red-200" : "border-border"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${log.status === "open" ? "bg-red-100" : "bg-green-100"}`}>
        {log.status === "open" ? "🚨" : "✅"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2">
          <span className="font-medium text-sm">{log.userName}</span>
          <span className="text-muted-foreground text-xs">{log.userEmail}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_BADGE[log.escalationLevel] ?? ""}`}>
            {log.escalationLevel} notified
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[log.status] ?? ""}`}>{log.status}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{log.reason}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-muted-foreground">Rule: <strong>{log.ruleName}</strong></span>
          <span className="text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
          {log.resolvedAt && <span className="text-xs text-green-600">Resolved {timeAgo(log.resolvedAt)}</span>}
        </div>
      </div>
      {log.status === "open" && onResolve && (
        <Button size="sm" variant="outline" onClick={onResolve} className="flex-shrink-0 text-xs h-7">
          Resolve
        </Button>
      )}
    </div>
  );
}
