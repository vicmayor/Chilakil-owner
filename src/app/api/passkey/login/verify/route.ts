import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  WEBAUTHN_COOKIE,
  openChallenge,
  parseTransports,
  relyingPartyFromRequest,
} from "@/lib/webauthn";

const FAIL = "No Face ID passkey matched this iPhone. Sign in with your password.";

export async function POST(request: NextRequest) {
  const sealed = request.cookies.get(WEBAUTHN_COOKIE)?.value;
  const challenge = sealed ? await openChallenge(sealed) : null;
  if (!challenge || challenge.type !== "authentication") {
    return NextResponse.json({ ok: false, error: "Face ID sign-in expired. Try again." }, { status: 400 });
  }

  let body: AuthenticationResponseJSON;
  try {
    body = (await request.json()) as AuthenticationResponseJSON;
  } catch {
    return NextResponse.json({ ok: false, error: FAIL }, { status: 401 });
  }

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: body.id },
    include: { user: true },
  });
  if (!passkey) {
    return NextResponse.json({ ok: false, error: FAIL }, { status: 401 });
  }

  const { rpID, origin } = relyingPartyFromRequest(request);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: parseTransports(passkey.transports),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: FAIL }, { status: 401 });
  }

  if (!verification.verified) {
    return NextResponse.json({ ok: false, error: FAIL }, { status: 401 });
  }

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      deviceType: verification.authenticationInfo.credentialDeviceType,
      backedUp: verification.authenticationInfo.credentialBackedUp,
      lastUsedAt: new Date(),
    },
  });

  const token = await signSession({
    id: passkey.user.id,
    email: passkey.user.email,
    name: passkey.user.name,
    role: passkey.user.role,
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.delete(WEBAUTHN_COOKIE);
  return response;
}
