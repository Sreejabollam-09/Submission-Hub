import { useState, useEffect, useRef } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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

const CHANNEL_BADGE: Record<string, { label: string; cls: string }> = {
  in_app: { label: "In-App",  cls: "bg-blue-100 text-blue-700" },
  email:  { label: "Email",   cls: "bg-amber-100 text-amber-700" },
  teams:  { label: "Teams",   cls: "bg-purple-100 text-purple-700" },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)  return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const headers = getUserHeader(user);

  const unread = notifications.filter(n => n.channel === "in_app" && !n.isRead).length;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { headers });
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data.filter((n: Notification) => n.channel === "in_app") : []);
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(id: number) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", headers });
    setNotifications(n => n.map(x => x.id === id ? { ...x, isRead: true } : x));
  }

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST", headers });
    setNotifications(n => n.map(x => ({ ...x, isRead: true })));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sidebar-accent/50 transition-colors"
        title="Notifications"
      >
        <svg className="w-4.5 h-4.5 text-[hsl(220,20%,55%)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-white border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div>
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unread > 0 && <p className="text-xs text-muted-foreground">{unread} unread</p>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-2xl mb-2">🔔</div>
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-accent/30 transition-colors ${!n.isRead ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium leading-tight ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                        {!n.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CHANNEL_BADGE[n.channel]?.cls ?? "bg-gray-100 text-gray-600"}`}>
                          {CHANNEL_BADGE[n.channel]?.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(n.sentAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
