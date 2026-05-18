import { useEffect, useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  designation: string | null;
  managerName: string | null;
  createdAt: string;
}

interface Cycle {
  id: number;
  name: string;
  year: number;
  status: string;
  goalSettingStart: string;
  goalSettingEnd: string;
}

interface ThrustArea {
  id: number;
  name: string;
  description: string | null;
}

const ROLE_BADGE: Record<string, string> = {
  employee: "bg-blue-100 text-blue-800",
  manager: "bg-green-100 text-green-800",
  admin: "bg-purple-100 text-purple-800",
};

export default function Admin({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState<"users" | "cycles" | "thrust">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([]);
  const [newArea, setNewArea] = useState({ name: "", description: "" });
  const { toast } = useToast();
  const headers = getUserHeader(user);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [uRes, cRes, tRes] = await Promise.all([
      fetch("/api/users", { headers }),
      fetch("/api/cycles", { headers }),
      fetch("/api/thrust-areas", { headers }),
    ]);
    const [u, c, t] = await Promise.all([uRes.json(), cRes.json(), tRes.json()]);
    setUsers(Array.isArray(u) ? u : []);
    setCycles(Array.isArray(c) ? c : []);
    setThrustAreas(Array.isArray(t) ? t : []);
  }

  async function activateCycle(cycleId: number) {
    await fetch(`/api/cycles/${cycleId}`, {
      method: "PUT", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    await loadAll();
    toast({ title: "Cycle activated" });
  }

  async function addThrustArea() {
    if (!newArea.name.trim()) return;
    await fetch("/api/thrust-areas", {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(newArea),
    });
    setNewArea({ name: "", description: "" });
    await loadAll();
    toast({ title: "Thrust area added" });
  }

  async function changeUserRole(userId: number, role: string) {
    await fetch(`/api/users/${userId}`, {
      method: "PUT", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await loadAll();
    toast({ title: "User role updated" });
  }

  const TABS = [
    { key: "users", label: "Users" },
    { key: "cycles", label: "Goal Cycles" },
    { key: "thrust", label: "Thrust Areas" },
  ] as const;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
      <p className="text-sm text-muted-foreground mb-6">Manage users, goal cycles, and thrust areas.</p>

      <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">All Users ({users.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Manager</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.department}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${ROLE_BADGE[u.role] ?? "bg-gray-100"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.managerName ?? "—"}</td>
                  <td className="px-5 py-3">
                    <select className="border border-input rounded-md px-2 py-1 text-xs bg-background"
                      value={u.role} onChange={e => changeUserRole(u.id, e.target.value)}>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "cycles" && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Goal Cycles</h2>
          </div>
          {cycles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No cycles configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Year</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Goal Setting Period</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {cycles.map(c => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">{c.year}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${c.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {c.goalSettingStart ? new Date(c.goalSettingStart).toLocaleDateString() : "—"} –{" "}
                      {c.goalSettingEnd ? new Date(c.goalSettingEnd).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {c.status !== "active" && (
                        <Button size="sm" variant="outline" onClick={() => activateCycle(c.id)}>Activate</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "thrust" && (
        <div className="space-y-4">
          {/* Add new thrust area */}
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <h2 className="font-semibold mb-4">Add Thrust Area</h2>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input value={newArea.name} onChange={e => setNewArea(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Digital Innovation" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={newArea.description} onChange={e => setNewArea(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description…" />
              </div>
              <div className="flex items-end">
                <Button onClick={addThrustArea}>Add</Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Thrust Areas ({thrustAreas.length})</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {thrustAreas.map(a => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{a.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{a.description ?? "—"}</td>
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
