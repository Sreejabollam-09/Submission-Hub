export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: string;
  designation: string | null;
  managerId: number | null;
  managerName: string | null;
}

const STORAGE_KEY = "goalTracker_user";

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getUserHeader(user: AuthUser | null): Record<string, string> {
  if (!user) return {};
  return { "x-user-id": String(user.id) };
}

export const DEMO_ACCOUNTS = [
  { email: "alice@company.com", password: "pass123", label: "Alice Johnson (Employee)" },
  { email: "bob@company.com", password: "pass123", label: "Bob Smith (Manager)" },
  { email: "carol@company.com", password: "pass123", label: "Carol White (Admin)" },
];
