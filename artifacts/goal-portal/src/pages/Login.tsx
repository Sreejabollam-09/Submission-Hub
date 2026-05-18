import { useState } from "react";
import { useLocation } from "wouter";
import { storeUser, DEMO_ACCOUNTS, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

interface AadModalProps {
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
}

function AzureADModal({ onClose, onLogin }: AadModalProps) {
  const [step, setStep] = useState<"email" | "password" | "mfa" | "loading">("email");
  const [aadEmail, setAadEmail] = useState("");
  const [aadPassword, setAadPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const VALID_EMAILS = DEMO_ACCOUNTS.map(a => a.email);

  async function handleSso() {
    setStep("loading");
    setError("");
    try {
      const res = await fetch("/api/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: aadEmail, aadToken: `aad_demo_${Date.now()}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SSO failed");
      storeUser({ ...data, ssoProvider: "microsoft" });
      onLogin({ ...data, ssoProvider: "microsoft" });
      toast({ title: "Signed in via Microsoft Entra ID" });
    } catch (e) {
      setError((e as Error).message);
      setStep("email");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* MS Header */}
        <div className="bg-[#0078d4] px-6 pt-6 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <svg width="24" height="24" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            <span className="text-white font-semibold text-sm">Microsoft</span>
          </div>
          <h2 className="text-white text-xl font-semibold">
            {step === "email" && "Sign in"}
            {step === "password" && "Enter password"}
            {step === "mfa" && "Verify your identity"}
            {step === "loading" && "Signing you in…"}
          </h2>
          {aadEmail && step !== "email" && (
            <p className="text-blue-200 text-sm mt-1">{aadEmail}</p>
          )}
        </div>

        <div className="px-6 py-5">
          {step === "email" && (
            <>
              <p className="text-xs text-gray-500 mb-4">
                Use your <strong>@company.com</strong> work account.<br />
                <span className="text-blue-600">Tenant: AtomQuest Hackathon (Demo)</span>
              </p>
              {error && <p className="text-red-600 text-xs mb-3 p-2 bg-red-50 rounded">{error}</p>}
              <label className="block text-xs text-gray-600 mb-1">Work email or UPN</label>
              <Input value={aadEmail} onChange={e => setAadEmail(e.target.value)}
                placeholder="user@company.com" type="email" autoFocus
                onKeyDown={e => e.key === "Enter" && VALID_EMAILS.includes(aadEmail) && setStep("password")} />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map(a => (
                  <button key={a.email} onClick={() => setAadEmail(a.email)}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                    {a.email.split("@")[0]}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center mt-5">
                <button onClick={onClose} className="text-sm text-blue-600 hover:underline">Back</button>
                <button
                  disabled={!VALID_EMAILS.includes(aadEmail)}
                  onClick={() => setStep("password")}
                  className="px-5 py-2 bg-[#0078d4] text-white text-sm rounded hover:bg-[#006cbf] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Next
                </button>
              </div>
            </>
          )}

          {step === "password" && (
            <>
              <label className="block text-xs text-gray-600 mb-1">Password</label>
              <Input value={aadPassword} onChange={e => setAadPassword(e.target.value)}
                type="password" placeholder="Enter your password" autoFocus
                onKeyDown={e => e.key === "Enter" && aadPassword.length >= 3 && setStep("mfa")} />
              <p className="text-xs text-gray-400 mt-1.5">Forgot my password · Sign-in options</p>
              <div className="flex justify-between items-center mt-5">
                <button onClick={() => setStep("email")} className="text-sm text-blue-600 hover:underline">Back</button>
                <button
                  disabled={aadPassword.length < 3}
                  onClick={() => setStep("mfa")}
                  className="px-5 py-2 bg-[#0078d4] text-white text-sm rounded hover:bg-[#006cbf] disabled:opacity-40 transition-colors">
                  Sign in
                </button>
              </div>
            </>
          )}

          {step === "mfa" && (
            <>
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-600">We sent a verification code to your Authenticator app</p>
              </div>
              <label className="block text-xs text-gray-600 mb-1">Enter code</label>
              <Input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code" autoFocus maxLength={6} className="text-center text-lg tracking-widest"
                onKeyDown={e => e.key === "Enter" && mfaCode.length === 6 && handleSso()} />
              <p className="text-xs text-center text-blue-500 mt-1.5 cursor-pointer hover:underline">Use "123456" for demo</p>
              <div className="flex justify-between items-center mt-5">
                <button onClick={() => setStep("password")} className="text-sm text-blue-600 hover:underline">Back</button>
                <button
                  disabled={mfaCode.length < 6}
                  onClick={handleSso}
                  className="px-5 py-2 bg-[#0078d4] text-white text-sm rounded hover:bg-[#006cbf] disabled:opacity-40 transition-colors">
                  Verify
                </button>
              </div>
            </>
          )}

          {step === "loading" && (
            <div className="text-center py-6">
              <svg className="w-8 h-8 animate-spin text-[#0078d4] mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500 mt-3">Authenticating with Microsoft Entra ID…</p>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Microsoft Entra ID · AtomQuest Tenant (Demo SSO)</p>
        </div>
      </div>
    </div>
  );
}

export default function Login({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAad, setShowAad] = useState(false);
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
    <>
      {showAad && <AzureADModal onClose={() => setShowAad(false)} onLogin={u => { setShowAad(false); onLogin(u); navigate("/"); }} />}

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
              {/* Microsoft SSO Button */}
              <button onClick={() => setShowAad(true)}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mb-4 text-sm font-medium text-gray-700 shadow-sm">
                <MicrosoftLogo />
                Sign in with Microsoft
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or sign in with password</span>
                <div className="flex-1 h-px bg-border" />
              </div>

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

              {/* Entra ID info strip */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-blue-700">
                  <strong>Microsoft Entra ID SSO</strong> — Use "Sign in with Microsoft" to demo Azure AD integration with MFA.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
