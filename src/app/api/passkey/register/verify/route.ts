import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WEBAUTHN_COOKIE, openChallenge, relyingPartyFromRequest } from "@/lib/webauthn";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const sealed = request.cookies.get(WEBAUTHN_COOKIE)?.value;
  const challenge = sealed ? await openChallenge(sealed) : null;
  if (!challenge || challenge.type !== "registration" || challenge.userId !== session.id) {
    return NextResponse.json({ ok: false, error: "Face ID setup expired. Try again." }, { status: 400 });
  }

  let body: RegistrationResponseJSON;
  try {
    body = (await request.json()) as RegistrationResponseJSON;
  } catch {
    return NextResponse.json({ ok: false, error: "Face ID could not be verified." }, { status: 400 });
  }

  const { rpID, origin } = relyingPartyFromRequest(request);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Face ID could not be verified." }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ ok: false, error: "Face ID could not be verified." }, { status: 400 });
  }

  const info = verification.registrationInfo;
  try {
    await prisma.passkey.create({
      data: {
        userId: session.id,
        credentialId: info.credential.id,
        publicKey: Buffer.from(info.credential.publicKey),
        counter: BigInt(info.credential.counter),
        transports: info.credential.transports ? JSON.stringify(info.credential.transports) : null,
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        aaguid: info.aaguid,
        label: "Face ID",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "This iPhone already has Face ID for Chilakil." },
        { status: 409 },
      );
    }
    throw error;
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(WEBAUTHN_COOKIE);
  return response;
}
