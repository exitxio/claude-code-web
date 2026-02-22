const AGENT_SERVER_URL =
  process.env.AUTOMATION_SERVER_URL || "http://localhost:8080";

const API_KEY = process.env.CCAPI_KEY || "";

export async function agentFetch(
  path: string,
  options: RequestInit & { username: string; timeoutMs?: number }
): Promise<Response> {
  const { username, timeoutMs = 5000, ...fetchOptions } = options;

  return fetch(`${AGENT_SERVER_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...(fetchOptions.headers as Record<string, string>),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}
