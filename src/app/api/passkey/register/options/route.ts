import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  RP_NAME,
  WEBAUTHN_COOKIE,
  challengeCookieOptions,
  parseTransports,
  relyingPartyFromRequest,
  sealChallenge,
} from "@/lib/webauthn";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const existing = await prisma.passkey.findMany({
    where: { userId: session.id },
    select: { credentialId: true, transports: true },
  });
  const { rpID } = relyingPartyFromRequest(request);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: session.email,
    userID: new TextEncoder().encode(session.id),
    userDisplayName: session.name,
    attestationType: "none",
    preferredAuthenticatorType: "localDevice",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
    excludeCredentials: existing.map((row) => ({
      id: row.credentialId,
      transports: parseTransports(row.transports),
    })),
  });

  const token = await sealChallenge({
    challenge: options.challenge,
    type: "registration",
    userId: session.id,
  });
  const response = NextResponse.json(options);
  response.cookies.set(WEBAUTHN_COOKIE, token, challengeCookieOptions());
  return response;
}
