export const API_ORIGIN = process.env.NEXT_PUBLIC_ZAGNU_GO_API_URL || "https://api.zagnu.com";
const BASE = `${API_ORIGIN}/public/outreach`;
const KEY = "outreach.session";

export type Task = {
  id: number;
  name: string;
  platform: string;
  handle: string;
  link: string;
  list: string;
  sender: string;
  message: string;
};

export type BadRow = { row: number; error: string };

export type Snapshot = {
  task: Task | null;
  left: number;
  total: number;
  sent_today: number;
  queued: number;
  waiting: number;
  limit_notes: string[];
  lists: string[];
  senders: string[];
  mode: "sheet" | "db";
  platform?: string;
  rows_need_fixing?: number;
  bad_rows?: BadRow[];
  last_synced?: string;
  sync_error?: string;
  notes_saved?: boolean;
  notice?: string;
};

export type Session = { session: string; user: string; can_rename: boolean };
export type Me = { user: string; can_rename: boolean };
export type Profile = { name: string; platform: string };
export type Config = { link_login: boolean; pw_login: boolean; ask_user: boolean; profiles?: Profile[] };

export type Template = { platform: string; label: string; text: string; default: string; customized: boolean; blanks?: string[] };
export type Templates = { templates: Template[]; blanks: string[] };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getSession(): string {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setSession(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

type Opts = { method?: string; body?: unknown; authed?: boolean };

export async function api<T>(path: string, { method = "GET", body, authed = true }: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getSession();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && authed) {
    clearSession();
    window.location.href = "/login";
    throw new ApiError(401, "login required");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `HTTP ${res.status}`);
  return data as T;
}

export function query(list: string, sender: string): string {
  const q = new URLSearchParams();
  if (list) q.set("list", list);
  if (sender) q.set("sender", sender);
  const s = q.toString();
  return s ? `?${s}` : "";
}
