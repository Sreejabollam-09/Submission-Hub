import { useEffect, useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";

interface AuditEntry {
  id: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

interface GoalSheetReport {
  id: number;
  employeeName: string;
  department: string;
  status: string;
  goalsCount: number;
  totalWeightage: number;
  submittedAt: string | null;
  approvedAt: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  submit: "bg-blue-100 text-blue-800",
  approve: "bg-green-100 text-green-800",
  return: "bg-red-100 text-red-700",
  create: "bg-gray-100 text-gray-600",
  update: "bg-yellow-100 text-yellow-800",
  delete: "bg-red-100 text-red-700",
};

export default function Reports({ user }: { user: AuthUser }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [sheets, setSheets] = useState<GoalSheetReport[]>([]);
  const [tab, setTab] = useState<"audit" | "sheets">("audit");
  const headers = getUserHeader(user);

  useEffect(() => {
    Promise.all([
      fetch("/api/audit-logs", { headers }).then(r => r.json()),
      fetch("/api/reports/goal-sheets", { headers }).then(r => r.json()),
    ]).then(([a, s]) => {
      setAudit(Array.isArray(a) ? a : []);
      setSheets(Array.isArray(s) ? s : []);
    }).catch(console.error);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Reports & Audit Trail</h1>
      <p className="text-sm text-muted-foreground mb-6">Full audit log of all actions and goal sheet status report.</p>

      <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
        <button onClick={() => setTab("audit")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "audit" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Audit Log
        </button>
        <button onClick={() => setTab("sheets")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "sheets" ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Goal Sheets Report
        </button>
      </div>

      {tab === "audit" && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          {audit.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No audit entries found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(entry => (
                  <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{entry.userName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-600"}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {entry.entityType.replace("_", " ")} #{entry.entityId}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {entry.reason ?? (entry.oldValue && entry.newValue ? `${entry.oldValue} → ${entry.newValue}` : entry.newValue ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "sheets" && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          {sheets.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No goal sheet data found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Goals</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Weightage</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Approved On</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map(s => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{s.employeeName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.department}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                        s.status === "approved" ? "bg-green-100 text-green-800" :
                        s.status === "submitted" ? "bg-blue-100 text-blue-800" :
                        s.status === "returned" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{s.goalsCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">{s.totalWeightage}%</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">
                      {s.approvedAt ? new Date(s.approvedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
