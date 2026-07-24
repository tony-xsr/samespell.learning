export type SessionRole = "user" | "admin";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Thiếu SESSION_SECRET trong biến môi trường server.");
  return secret;
}

export async function createSessionToken(role: SessionRole): Promise<string> {
  const secret = requireSecret();
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${role}.${expiresAt}`;
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toHex(signature)}`;
}

export async function getSessionRole(token: string | undefined): Promise<SessionRole | null> {
  if (!token) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [role, expiresAtStr, signatureHex] = parts;
  if (role !== "user" && role !== "admin") return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const key = await getKey(secret);
  const expectedSignature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${role}.${expiresAtStr}`),
  );
  const expectedHex = toHex(expectedSignature);
  if (expectedHex.length !== signatureHex.length) return null;

  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return diff === 0 ? (role as SessionRole) : null;
}

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = TTL_MS / 1000;
