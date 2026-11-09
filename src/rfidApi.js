const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://altamia-christannlhoyd-new.onrender.com"
).replace(/\/+$/, "");

export async function apiRequest(path, options = {}) {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  let response;

  try {
    response = await fetch(url, {
      ...options,
      credentials: "omit",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    throw new Error(`Cannot connect to attendance API: ${err.message}`);
  }

  const raw = await response.text();

  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `Attendance API returned HTML or invalid JSON. HTTP ${response.status}. URL: ${url}`
    );
  }

  if (!response.ok || data.success === false) {
    const error = new Error(
      data.message || data.error || `Request failed (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}
