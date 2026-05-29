import { createMemo, createSignal, Show } from "solid-js"
import { useFile } from "@/context/file"
import { Markdown } from "@kode/ui/markdown"
import { Button } from "@kode/ui/button"
import { useLanguage } from "@/context/language"

export function AntigravityArtifactViewer(props: {
  path: string
}) {
  const file = useFile()
  const language = useLanguage()
  const [approved, setApproved] = createSignal<"approve" | "reject" | null>(null)

  const content = createMemo(() => {
    const data = file.get(props.path)?.content?.content
    return data || ""
  })

  const isPlan = createMemo(() => props.path.toLowerCase().includes("plan"))
  const showBanner = createMemo(() => isPlan() && content().length > 0 && !approved())

  return (
    <div class="h-full w-full flex flex-col bg-background-base">
      <div class="flex-1 overflow-y-auto p-6 text-text-base">
        <Show when={content()} fallback={
          <div class="flex items-center justify-center h-full text-text-weak text-14-regular">
            {language.t("session.artifacts.empty") || "No artifact loaded"}
          </div>
        }>
          <Markdown text={content()} />
        </Show>
      </div>
      <Show when={showBanner()}>
        <div class="sticky bottom-0 left-0 right-0 border-t border-border-weak-base bg-surface-raised-base px-6 py-3 flex items-center justify-between">
          <span class="text-13-medium text-text-strong">{language.t("session.artifacts.approvePrompt") || "Review the plan above"}</span>
          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => setApproved("reject")}
            >
              {language.t("common.cancel") || "Revise"}
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={() => setApproved("approve")}
            >
              {language.t("common.continue") || "Approve Plan"}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  )
}
