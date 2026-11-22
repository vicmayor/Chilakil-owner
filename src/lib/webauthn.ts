import { jwtVerify, SignJWT } from "jose";
import { getSecretKey } from "@/lib/session-token";

export const WEBAUTHN_COOKIE = "chilakil_webauthn";
export const RP_NAME = "Chilakil Owner";

export type WebAuthnChallenge = {
  challenge: string;
  type: "registration" | "authentication";
  userId?: string;
};

/**
 * RP ID is the request hostname.
 * `chilakil-owner.vercel.app` and each Vercel preview host are separate sites:
 * `vercel.app` is a public suffix, so one RP ID cannot cover both.
 * An optional WEBAUTHN_RP_ID is used only when it is the host or a parent of it.
 */
export function relyingPartyFromRequest(request: Request): { rpID: string; origin: string } {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = (forwardedHost ?? request.headers.get("host") ?? "localhost").split(",")[0].trim();
  const hostname = hostHeader.split(":")[0].toLowerCase();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = (
    forwardedProto ?? (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https")
  )
    .split(",")[0]
    .trim();

  const host = hostname === "127.0.0.1" ? "localhost" : hostname;
  const override = process.env.WEBAUTHN_RP_ID?.trim().toLowerCase();
  const rpID = override && (host === override || host.endsWith(`.${override}`)) ? override : host;
  const originOverride = process.env.WEBAUTHN_ORIGIN?.trim();
  const origin = originOverride || `${proto}://${hostHeader}`;
  return { rpID, origin };
}

export function challengeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 5,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function sealChallenge(payload: WebAuthnChallenge): Promise<string> {
  return new SignJWT({
    challenge: payload.challenge,
    type: payload.type,
    userId: payload.userId ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecretKey());
}

export async function openChallenge(token: string): Promise<WebAuthnChallenge | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.challenge !== "string") return null;
    if (payload.type !== "registration" && payload.type !== "authentication") return null;
    const userId = typeof payload.userId === "string" && payload.userId ? payload.userId : undefined;
    return { challenge: payload.challenge, type: payload.type, userId };
  } catch {
    return null;
  }
}

export function parseTransports(value: string | null | undefined): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return undefined;
  }
}
