export async function parseJsonResponse<T = any>(response: Response): Promise<T | null> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: "The server returned an empty or invalid response.",
    } as T;
  }
}
