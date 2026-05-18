import { getStoredUser } from "./auth";

export async function customFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const user = getStoredUser();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (user) {
    headers["x-user-id"] = String(user.id);
  }
  return fetch(url, { ...options, headers });
}
