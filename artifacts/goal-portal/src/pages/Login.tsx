import { useState } from "react";
import { useLocation } from "wouter";
import { storeUser, DEMO_ACCOUNTS, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Login({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      storeUser(data.user as AuthUser);
      onLogin(data.user as AuthUser);
      navigate("/");
    } catch (err) {
      toast({ title: "Login failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(acc: (typeof DEMO_ACCOUNTS)[0]) {
    setEmail(acc.email);
    setPassword(acc.password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(222,47%,10%)] to-[hsl(230,76%,25%)]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-[hsl(222,47%,13%)] px-8 pt-8 pb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(230,76%,55%)] flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">AtomQuest Goal Tracker</h1>
            <p className="text-[hsl(220,20%,65%)] text-sm mt-1">ATOMQUEST HACKATHON 1.0</p>
          </div>

          <div className="px-8 py-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground text-center mb-3 font-medium uppercase tracking-wide">Demo Accounts</p>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map(acc => (
                  <button key={acc.email} onClick={() => quickLogin(acc)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-colors text-sm flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${acc.email.startsWith("a") ? "bg-[hsl(230,76%,55%)]" : acc.email.startsWith("b") ? "bg-[hsl(160,60%,45%)]" : "bg-[hsl(280,65%,60%)]"}`}>
                      {acc.label[0]}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{acc.label}</div>
                      <div className="text-muted-foreground text-xs">{acc.email} / {acc.password}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
