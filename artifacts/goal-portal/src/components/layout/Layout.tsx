import Sidebar from "./Sidebar";
import { type AuthUser } from "@/lib/auth";

export default function Layout({ user, onLogout, children }: {
  user: AuthUser;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
