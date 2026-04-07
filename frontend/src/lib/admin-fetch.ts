/** Browser-only: calls the Next.js BFF which mints a JWT for the Go admin API. */
export async function adminFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/admin-backend/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || res.statusText);
  }
  if (!res.ok) {
    const msg = typeof data === "object" && data && "message" in data ? String((data as { message: string }).message) : text;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}
