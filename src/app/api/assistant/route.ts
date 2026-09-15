import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { parseLocationScope } from "@/lib/location";
import { buildSnapshot, deterministicAnswer, llmAnswer } from "@/lib/ai";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json()) as { question?: string; scope?: string; threadId?: string };
  const question = (body.question ?? "").trim();
  if (!question) {
    return Response.json({ error: "Ask a question." }, { status: 400 });
  }
  const scope = parseLocationScope(body.scope);

  const snapshot = await buildSnapshot(scope);
  let source: "llm" | "local" = "local";
  let answer = deterministicAnswer(question, snapshot);

  try {
    const llm = await llmAnswer(question, snapshot);
    if (llm) {
      answer = llm;
      source = "llm";
    }
  } catch {
    source = "local";
  }

  const thread = body.threadId
    ? await prisma.aiThread.findUnique({ where: { id: body.threadId } })
    : await prisma.aiThread.create({
        data: {
          title: question.slice(0, 80),
          locationScope: scope,
        },
      });

  if (thread) {
    await prisma.aiMessage.createMany({
      data: [
        { threadId: thread.id, role: "user", content: question },
        { threadId: thread.id, role: "assistant", content: answer },
      ],
    });
  }

  return Response.json({ answer, source, threadId: thread?.id, notice: snapshot.notice });
}
