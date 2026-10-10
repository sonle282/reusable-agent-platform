let csrfToken = "";

export function setCsrf(value: string) { csrfToken = value; }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  if (!(["GET", "HEAD"].includes(init.method ?? "GET")) && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const details = Array.isArray(data.details) ? `\n${data.details.join("\n")}` : "";
    throw new Error(`${String(data.error ?? `Request failed (${response.status})`)}${details}`);
  }
  return data as T;
}

export function post<T>(path: string, body?: unknown) {
  return api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

export function patch<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

