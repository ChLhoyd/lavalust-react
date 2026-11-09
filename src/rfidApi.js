export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("The attendance API returned HTML instead of JSON. Check the LavaLust exception log and API route.");
  }
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}
