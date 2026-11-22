import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import {
  WEBAUTHN_COOKIE,
  challengeCookieOptions,
  relyingPartyFromRequest,
  sealChallenge,
} from "@/lib/webauthn";

export async function POST(request: Request) {
  const { rpID } = relyingPartyFromRequest(request);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });
  const token = await sealChallenge({
    challenge: options.challenge,
    type: "authentication",
  });
  const response = NextResponse.json(options);
  response.cookies.set(WEBAUTHN_COOKIE, token, challengeCookieOptions());
  return response;
}
