import { getLocationScope } from "@/lib/scope";
import { TopBar } from "@/components/top-bar";
import { AssistantChat } from "@/components/assistant-chat";
import { SUGGESTED_QUESTIONS } from "@/lib/ai";

export const metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  const scope = await getLocationScope();
  return (
    <>
      <TopBar
        title="Ask Chilakil"
        subtitle="Answers from the local books. No live platform APIs."
        scope={scope}
      />
      <AssistantChat scope={scope} suggestions={SUGGESTED_QUESTIONS} />
    </>
  );
}
