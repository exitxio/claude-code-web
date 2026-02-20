import crypto from "crypto";

const AUTOMATION_SERVER_URL =
  process.env.AUTOMATION_SERVER_URL || "http://localhost:8080";

export function generateToken(username: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  const timestamp = Date.now();
  const data = `${username}:${timestamp}`;
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return Buffer.from(`${data}:${hmac}`).toString("base64");
}

export async function automationFetch(
  path: string,
  options: RequestInit & { username: string; timeoutMs?: number }
): Promise<Response> {
  const { username, timeoutMs = 5000, ...fetchOptions } = options;
  const token = generateToken(username);

  return fetch(`${AUTOMATION_SERVER_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(fetchOptions.headers as Record<string, string>),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}
