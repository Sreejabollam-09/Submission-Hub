import { useEffect, useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface ThrustBreakdown {
  thrustAreaId: number;
  thrustAreaName: string;
  goalCount: number;
  avgWeightage: number;
  avgProgress: number | null;
}

interface Summary {
  totalEmployees: number;
  goalsApproved: number;
  goalsSubmitted: number;
  goalsDraft: number;
  avgCompletionRate: number;
  checkInsCompleted: number;
  checkInsPending: number;
}

interface TeamMember {
  employeeName: string;
  department: string;
  progressScore: number | null;
  goalSheetStatus: string;
  completedGoals: number;
  goalsCount: number;
}

const COLORS = ["hsl(230,76%,55%)", "hsl(160,60%,45%)", "hsl(38,92%,50%)", "hsl(280,65%,60%)", "hsl(0,84%,60%)", "hsl(200,70%,50%)"];

export default function Analytics({ user }: { user: AuthUser }) {
  const [thrust, setThrust] = useState<ThrustBreakdown[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const headers = getUserHeader(user);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/thrust-area-breakdown", { headers }).then(r => r.json()),
      fetch("/api/dashboard/summary", { headers }).then(r => r.json()),
      fetch("/api/dashboard/team-progress", { headers }).then(r => r.json()),
    ]).then(([t, s, tm]) => {
      setThrust(Array.isArray(t) ? t : []);
      setSummary(s);
      setTeam(Array.isArray(tm) ? tm : []);
    });
  }, []);

  const sheetStatusData = summary ? [
    { name: "Approved", value: summary.goalsApproved },
    { name: "Submitted", value: summary.goalsSubmitted },
    { name: "Draft / Returned", value: summary.goalsDraft },
  ].filter(d => d.value > 0) : [];

  const teamScoreData = team
    .filter(m => m.progressScore !== null)
    .map(m => ({ name: m.employeeName.split(" ")[0], score: m.progressScore, dept: m.department }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-sm text-muted-foreground mb-7">Goal cycle insights and performance breakdown for FY 2025-26.</p>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Goal Sheet Status */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="font-semibold mb-4">Goal Sheet Status Distribution</h2>
          {sheetStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sheetStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  dataKey="value" paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                  {sheetStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>

        {/* Thrust Area Breakdown */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="font-semibold mb-4">Goals by Thrust Area</h2>
          {thrust.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={thrust} margin={{ top: 5, right: 5, left: -15, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                <XAxis dataKey="thrustAreaName" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, "Goals"]} />
                <Bar dataKey="goalCount" name="Goals" radius={[4, 4, 0, 0]}>
                  {thrust.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Team Scores */}
      {teamScoreData.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm mb-6">
          <h2 className="font-semibold mb-4">Team Progress Scores</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={teamScoreData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, "Progress Score"]} />
              <Bar dataKey="score" name="Progress Score" fill="hsl(230,76%,55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Thrust area avg weightage table */}
      {thrust.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Thrust Area Summary</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Thrust Area</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Goals</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">Avg Weightage</th>
              </tr>
            </thead>
            <tbody>
              {thrust.map(t => (
                <tr key={t.thrustAreaId} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium">{t.thrustAreaName}</td>
                  <td className="px-4 py-3 text-right">{t.goalCount}</td>
                  <td className="px-5 py-3 text-right font-semibold text-primary">{t.avgWeightage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
