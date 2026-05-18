import { useEffect, useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";
import { Button } from "@/components/ui/button";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  channel: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  sentAt: string;
}

const TYPE_ICON: Record<string, string> = {
  goal_submitted:      "📋",
  goal_approved:       "✅",
  goal_returned:       "↩️",
  checkin_submitted:   "📊",
  checkin_reminder:    "⏰",
  escalation_employee: "🚨",
  escalation_manager:  "⚠️",
  escalation_hr:       "🔴",
};

const TYPE_LABEL: Record<string, string> = {
  goal_submitted:      "Goal Submitted",
  goal_approved:       "Goal Approved",
  goal_returned:       "Goal Returned",
  checkin_submitted:   "Check-in Submitted",
  checkin_reminder:    "Check-in Reminder",
  escalation_employee: "Escalation — Employee",
  escalation_manager:  "Escalation — Manager",
  escalation_hr:       "Escalation — HR",
};

const CHANNEL_CONFIG: Record<string, { label: string; icon: string; cls: string }> = {
  in_app: { label: "In-App",  icon: "🔔", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  email:  { label: "Email",   icon: "📧", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  teams:  { label: "Teams",   icon: "💬", cls: "bg-purple-100 text-purple-700 border-purple-200" },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Notifications({ user }: { user: AuthUser }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const headers = getUserHeader(user);

  const endpoint = user.role === "admin" ? "/api/notifications/all" : "/api/notifications";

  useEffect(() => {
    fetch(endpoint, { headers })
      .then(r => r.json())
      .then(d => setNotifications(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST", headers });
    setNotifications(n => n.map(x => ({ ...x, isRead: true })));
  }

  async function markRead(id: number) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", headers });
    setNotifications(n => n.map(x => x.id === id ? { ...x, isRead: true } : x));
  }

  const filtered = notifications
    .filter(n => filterChannel === "all" || n.channel === filterChannel)
    .filter(n => filterType === "all" || n.type === filterType);

  const unreadCount = notifications.filter(n => n.channel === "in_app" && !n.isRead).length;

  // Group by type for counts
  const channelCounts = ["in_app", "email", "teams"].map(ch => ({
    ch, count: notifications.filter(n => n.channel === ch).length,
  }));

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user.role === "admin"
              ? "All system notifications — email, Teams, and in-app events across all users."
              : "Your goal and check-in notifications across all channels."}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read</Button>
        )}
      </div>

      {/* Channel stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {channelCounts.map(({ ch, count }) => {
          const cfg = CHANNEL_CONFIG[ch]!;
          return (
            <button key={ch} onClick={() => setFilterChannel(filterChannel === ch ? "all" : ch)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${filterChannel === ch ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/40"}`}>
              <span className="text-2xl">{cfg.icon}</span>
              <div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{cfg.label} notifications</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setFilterType("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterType === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/50"}`}>
          All types
        </button>
        {Object.entries(TYPE_LABEL).map(([key, label]) => (
          notifications.some(n => n.type === key) ? (
            <button key={key} onClick={() => setFilterType(filterType === key ? "all" : key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${filterType === key ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/50"}`}>
              <span>{TYPE_ICON[key]}</span> {label}
            </button>
          ) : null
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading notifications…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-16 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <h3 className="font-semibold">No notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">Notifications appear here when goals are submitted, approved, or returned.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div key={`${n.id}-${n.channel}`}
              onClick={() => !n.isRead && n.channel === "in_app" && markRead(n.id)}
              className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-all ${
                !n.isRead && n.channel === "in_app" ? "border-blue-200 bg-blue-50/30 cursor-pointer hover:bg-blue-50/60" : "border-border"
              }`}>
              <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{n.title}</p>
                  {!n.isRead && n.channel === "in_app" && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>

                {/* Teams deep-link simulation */}
                {n.channel === "teams" && n.relatedEntityId && (
                  <div className="mt-2 p-2 bg-[hsl(252,60%,97%)] border border-[hsl(252,60%,90%)] rounded-lg flex items-center gap-2">
                    <span className="text-[hsl(252,60%,50%)]">💬</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-[hsl(252,60%,50%)]">Teams Adaptive Card</p>
                      <p className="text-xs text-muted-foreground">View {n.relatedEntityType?.replace("_", " ")} →</p>
                    </div>
                    <span className="text-xs text-[hsl(252,60%,50%)] font-medium cursor-pointer hover:underline">Open in App</span>
                  </div>
                )}

                {/* Email preview */}
                {n.channel === "email" && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-700">📧 Email Preview</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Subject: {n.title} — AtomQuest Goal Tracker</p>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2">
                  {(() => {
                    const cfg = CHANNEL_CONFIG[n.channel];
                    return cfg ? (
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>
                    ) : null;
                  })()}
                  <span className="text-xs text-muted-foreground">{TYPE_LABEL[n.type] ?? n.type}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(n.sentAt)}</span>
                  {user.role === "admin" && (n as any).userId && (
                    <span className="text-xs text-muted-foreground ml-auto">User #{(n as any).userId}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
