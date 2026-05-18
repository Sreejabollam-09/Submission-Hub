import { useEffect, useState } from "react";
import { type AuthUser } from "@/lib/auth";
import { getUserHeader } from "@/lib/auth";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Summary {
  totalEmployees: number;
  goalsSubmitted: number;
  goalsApproved: number;
  goalsDraft: number;
  avgCompletionRate: number;
  checkInsCompleted: number;
  checkInsPending: number;
  currentQuarter: string | null;
}

interface TeamMember {
  employeeId: number;
  employeeName: string;
  department: string;
  goalSheetStatus: string;
  checkInStatus: string | null;
  progressScore: number | null;
  goalsCount: number;
  completedGoals: number;
}

interface CompletionStatus {
  goalSetting: { total: number; completed: number; percentage: number };
  q1: { total: number; completed: number; percentage: number };
  q2: { total: number; completed: number; percentage: number };
  q3: { total: number; completed: number; percentage: number };
  q4: { total: number; completed: number; percentage: number };
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  submitted: "bg-blue-100 text-blue-800",
  draft: "bg-gray-100 text-gray-600",
  returned: "bg-red-100 text-red-700",
  none: "bg-gray-100 text-gray-500",
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard({ user }: { user: AuthUser }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [completion, setCompletion] = useState<CompletionStatus | null>(null);
  const headers = getUserHeader(user);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/summary", { headers }).then(r => r.json()),
      fetch("/api/dashboard/team-progress", { headers }).then(r => r.json()),
      fetch("/api/dashboard/completion-status", { headers }).then(r => r.json()),
    ]).then(([s, t, c]) => {
      setSummary(s);
      setTeam(Array.isArray(t) ? t : []);
      setCompletion(c);
    }).catch(console.error);
  }, []);

  const isManagerOrAdmin = user.role === "manager" || user.role === "admin";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-foreground">Good {getTimeGreeting()}, {user.name.split(" ")[0]}!</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {summary?.currentQuarter ? `Currently in ${summary.currentQuarter} check-in period · ` : ""}
          <span className="capitalize">{user.role}</span> · {user.department}
        </p>
      </div>

      {/* Quick actions for employee */}
      {user.role === "employee" && (
        <div className="grid grid-cols-2 gap-4 mb-7">
          <Link href="/goal-sheets">
            <div className="bg-[hsl(230,76%,55%)] rounded-xl p-5 text-white cursor-pointer hover:bg-[hsl(230,76%,50%)] transition-colors">
              <p className="text-sm font-medium opacity-80">My Goal Sheet</p>
              <p className="text-xl font-bold mt-1">View & Edit Goals</p>
              <p className="text-xs opacity-70 mt-1">Set your annual goals</p>
            </div>
          </Link>
          <Link href="/check-ins">
            <div className="bg-[hsl(160,60%,42%)] rounded-xl p-5 text-white cursor-pointer hover:bg-[hsl(160,60%,38%)] transition-colors">
              <p className="text-sm font-medium opacity-80">Quarterly Check-in</p>
              <p className="text-xl font-bold mt-1">Submit Progress</p>
              <p className="text-xs opacity-70 mt-1">{summary?.currentQuarter ?? "Q1"} self-assessment</p>
            </div>
          </Link>
        </div>
      )}

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
          {isManagerOrAdmin && (
            <StatCard label="Total Employees" value={summary.totalEmployees} />
          )}
          <StatCard label="Goals Approved" value={summary.goalsApproved} color="text-green-600" />
          <StatCard label="Goals Submitted" value={summary.goalsSubmitted} color="text-blue-600" />
          <StatCard label="Avg Progress" value={`${summary.avgCompletionRate.toFixed(1)}%`}
            sub="based on check-ins" color="text-primary" />
          <StatCard label="Check-ins Submitted" value={summary.checkInsCompleted} />
        </div>
      )}

      {/* Completion status */}
      {completion && isManagerOrAdmin && (
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm mb-7">
          <h2 className="font-semibold text-foreground mb-4">Goal Cycle Completion Status</h2>
          <div className="space-y-3">
            {[
              { label: "Goal Setting", data: completion.goalSetting },
              { label: "Q1 Check-in", data: completion.q1 },
              { label: "Q2 Check-in", data: completion.q2 },
              { label: "Q3 Check-in", data: completion.q3 },
              { label: "Q4 Check-in", data: completion.q4 },
            ].map(({ label, data }) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-28 text-sm text-muted-foreground">{label}</div>
                <Progress value={data.percentage} className="flex-1 h-2" />
                <div className="text-sm font-medium w-24 text-right">
                  {data.completed}/{data.total} ({data.percentage.toFixed(0)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team progress table */}
      {isManagerOrAdmin && team.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Team Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Goal Sheet</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check-in</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Progress</th>
                </tr>
              </thead>
              <tbody>
                {team.map(m => (
                  <tr key={m.employeeId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-medium">{m.employeeName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.department}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[m.goalSheetStatus] ?? STATUS_COLORS.none}`}>
                        {m.goalSheetStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.checkInStatus ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[m.checkInStatus] ?? STATUS_COLORS.none}`}>
                          {m.checkInStatus}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {m.progressScore !== null ? `${m.progressScore.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
