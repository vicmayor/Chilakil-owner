"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

const SENSITIVE_CATEGORIES = new Set(["complaint", "refund", "allergy", "catering"]);

function needsGate(category: string, flagged: boolean) {
  return flagged || SENSITIVE_CATEGORIES.has(category);
}

export async function approveMessage(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();
  const message = await prisma.customerMessage.findUnique({ where: { id } });
  if (!message) throw new Error("Message not found");
  if (!reply) throw new Error("Reply cannot be empty");
  if (needsGate(message.category, message.sensitive) && !message.requiresOwnerApproval) {
    // still require an explicit approve path
  }
  await prisma.customerMessage.update({
    where: { id },
    data: {
      draftReply: reply,
      approvedReply: reply,
      status: "sent",
      ownerNote: "Approved by owner",
    },
  });
  revalidatePath("/messages");
  revalidatePath(`/messages/${id}`);
}

export async function rejectMessage(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  await prisma.customerMessage.update({
    where: { id },
    data: {
      status: "rejected",
      ownerNote: note || "Rejected by owner — do not send",
    },
  });
  revalidatePath("/messages");
  revalidatePath(`/messages/${id}`);
}

export async function saveDraft(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();
  const message = await prisma.customerMessage.findUnique({ where: { id } });
  if (!message) throw new Error("Message not found");
  await prisma.customerMessage.update({
    where: { id },
    data: {
      draftReply: reply,
      status: message.requiresOwnerApproval ? "pending_approval" : "pending_approval",
    },
  });
  revalidatePath("/messages");
  revalidatePath(`/messages/${id}`);
}
