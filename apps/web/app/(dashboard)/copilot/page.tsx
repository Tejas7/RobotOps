"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageTitle } from "@/components/pages/page-title";
import { useAuthedMutation } from "@/hooks/use-authed-mutation";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { useGlobalFilters } from "@/store/use-global-filters";

interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  citations: Array<{ resource: string; reason: string }>;
}

interface CopilotThread {
  id: string;
  siteId: string | null;
  createdAt: string;
  messages: CopilotMessage[];
}

const EXAMPLE_PROMPTS = [
  "Why did mission throughput drop in Zone A yesterday",
  "Show me the top recurring failure mode this week",
  "Which robots have battery degradation patterns",
  "Summarize open critical incidents and suggested actions",
  "Compare vendor performance for navigation incidents"
];

export default function CopilotPage() {
  const { siteId } = useGlobalFilters();
  const [threadId, setThreadId] = useState("ct1");
  const [draft, setDraft] = useState(EXAMPLE_PROMPTS[0]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const threadQuery = useAuthedQuery<CopilotThread | null>(["copilot-thread", threadId], `/copilot/thread/${threadId}`);
  const createThreadMutation = useAuthedMutation<{ id: string }>();
  const sendMessageMutation = useAuthedMutation<CopilotMessage>();

  const messages = threadQuery.data?.messages ?? [];
  const suggestions = useMemo(
    () =>
      messages
        .filter((message) => message.role === "assistant")
        .flatMap((message) =>
          message.content.toLowerCase().includes("recommend")
            ? [
                {
                  id: `${message.id}-suggestion`,
                  label: "Apply suggested ops action"
                }
              ]
            : []
        ),
    [messages]
  );

  async function createThread() {
    const thread = await createThreadMutation.mutateAsync({ path: `/copilot/thread?site_id=${siteId}`, method: "POST" });
    setThreadId(thread.id);
  }

  async function sendMessage(content: string) {
    if (!content.trim()) return;

    await sendMessageMutation.mutateAsync({
      path: "/copilot/message",
      method: "POST",
      body: {
        thread_id: threadId,
        content
      }
    });

    setDraft("");
    await threadQuery.refetch();
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Copilot" subtitle="Conversational ops insights with tool-backed responses, citations, and confirmation-gated suggestions." />

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <CardTitle>Threads</CardTitle>
          <CardMeta>Create and open tenant-scoped copilot threads</CardMeta>
          <div className="mt-3 space-y-2">
            <button
              className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${threadId === "ct1" ? "border-primary bg-blue-50" : "border-border bg-white"}`}
              onClick={() => setThreadId("ct1")}
            >
              Default demo thread
            </button>
            {threadQuery.data?.id && threadQuery.data.id !== "ct1" ? (
              <button className="w-full rounded-2xl border border-primary bg-blue-50 px-3 py-2 text-left text-sm" onClick={() => setThreadId(threadQuery.data!.id)}>
                Active thread ({threadQuery.data.id.slice(0, 8)})
              </button>
            ) : null}
            <Button className="w-full" onClick={createThread} disabled={createThreadMutation.isPending}>
              {createThreadMutation.isPending ? "Creating..." : "New thread"}
            </Button>
          </div>

          <Card className="mt-4">
            <CardTitle>Prompt examples</CardTitle>
            <div className="mt-2 space-y-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="w-full rounded-xl border border-border bg-white px-2 py-1.5 text-left text-xs text-muted"
                  onClick={() => setDraft(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </Card>
        </Card>

        <Card>
          <CardTitle>Conversation</CardTitle>
          <CardMeta>Copilot calls internal tools (`query_robots`, `query_missions`, `query_incidents`, `query_telemetry`) and cites records.</CardMeta>

          <div className="mt-4 h-[480px] space-y-3 overflow-y-auto rounded-2xl border border-border bg-white p-3">
            {messages.map((message) => (
              <div key={message.id} className={`rounded-2xl border p-3 ${message.role === "user" ? "ml-8 border-blue-200 bg-blue-50" : "mr-8 border-border bg-surface"}`}>
                <p className="text-xs uppercase tracking-wide text-muted">{message.role}</p>
                <p className="mt-1 text-sm">{message.content}</p>
                {Array.isArray(message.citations) && message.citations.length ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-muted">Citations</p>
                    {message.citations.map((citation) => (
                      <p key={`${citation.resource}-${citation.reason}`} className="text-xs text-muted">
                        {citation.resource} - {citation.reason}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-full border border-border bg-white px-4 py-2 text-sm"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask RobotOps"
            />
            <Button onClick={() => void sendMessage(draft)} disabled={sendMessageMutation.isPending}>
              {sendMessageMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </div>

          {suggestions.length ? (
            <Card className="mt-4">
              <CardTitle>Suggested actions</CardTitle>
              <CardMeta>Suggestions never execute control actions automatically</CardMeta>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <Button key={suggestion.id} variant="secondary" onClick={() => setPendingAction(suggestion.label)}>
                    {suggestion.label}
                  </Button>
                ))}
              </div>
            </Card>
          ) : null}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title="Confirm suggested action"
        description="Copilot can prepare the action, but robot control execution remains blocked here. Open Fleet controls to execute with explicit confirmation."
        confirmLabel="Acknowledge"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => setPendingAction(null)}
      />
    </div>
  );
}
