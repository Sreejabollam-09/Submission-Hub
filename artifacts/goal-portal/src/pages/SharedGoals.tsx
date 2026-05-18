import { useEffect, useState } from "react";
import { type AuthUser, getUserHeader } from "@/lib/auth";

interface SharedGoal {
  id: number;
  title: string;
  description: string | null;
  ownerName: string;
  participantNames: string[];
  status: string;
  weightage: number;
  uomType: string;
  target: string;
  uomUnit: string;
}

const UOM_LABELS: Record<string, string> = {
  numeric_min: "Numeric (↑)",
  numeric_max: "Numeric (↓)",
  zero: "Zero-incident",
  timeline: "Timeline",
};

export default function SharedGoals({ user }: { user: AuthUser }) {
  const [goals, setGoals] = useState<SharedGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const headers = getUserHeader(user);

  useEffect(() => {
    fetch("/api/shared-goals", { headers })
      .then(r => r.json())
      .then(data => setGoals(Array.isArray(data) ? data : []))
      .catch(() => setGoals([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Shared Goals</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Goals shared across multiple employees for collaborative tracking.
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading…</div>
      ) : goals.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-1">No shared goals yet</h3>
          <p className="text-muted-foreground text-sm">
            Shared goals appear here when goals are linked across multiple employees.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(g => (
            <div key={g.id} className="bg-white border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{g.title}</h3>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${
                      g.status === "on_track" ? "bg-blue-100 text-blue-800" :
                      g.status === "completed" ? "bg-green-100 text-green-800" :
                      g.status === "at_risk" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                    }`}>{g.status.replace("_", " ")}</span>
                  </div>
                  {g.description && <p className="text-sm text-muted-foreground mb-2">{g.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Owner: <span className="text-foreground font-medium">{g.ownerName}</span></span>
                    <span>·</span>
                    <span>Target: <span className="text-foreground font-medium">{g.target} {g.uomUnit}</span></span>
                    <span>·</span>
                    <span>{UOM_LABELS[g.uomType] ?? g.uomType}</span>
                  </div>
                  {g.participantNames?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {g.participantNames.map((n, i) => (
                        <span key={i} className="px-2 py-0.5 bg-accent text-accent-foreground rounded text-xs">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-bold text-primary">{g.weightage}%</div>
                  <div className="text-xs text-muted-foreground">weightage</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
