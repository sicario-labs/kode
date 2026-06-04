import { createMemo, createSignal, For, Show, type Component } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { useSDK } from "@/context/sdk"
import { usePrompt } from "@/context/prompt"
import { useDialog } from "@kode/ui/context/dialog"
import { Dialog } from "@kode/ui/dialog"
import { ButtonV2 } from "@kode/ui/v2/components/button-v2.jsx"
import { Icon } from "@kode/ui/v2/components/icon.jsx"
import { base64Encode } from "@kode/core/util/encode"
import { useLanguage } from "@/context/language"

interface Question {
  id: string
  label: string
  options: { value: string; label: string; description: string }[]
}

const questions: Question[] = [
  {
    id: "scope",
    label: "What area should I grill you on?",
    options: [
      { value: "architecture", label: "Architecture", description: "System design, trade-offs, scaling" },
      { value: "code-quality", label: "Code Quality", description: "Patterns, conventions, edge cases" },
      { value: "security", label: "Security", description: "Vulnerabilities, auth, data handling" },
      { value: "performance", label: "Performance", description: "Bottlenecks, optimization, memory" },
    ],
  },
  {
    id: "depth",
    label: "How deep should we go?",
    options: [
      { value: "light", label: "Surface Level", description: "Quick check, broad coverage" },
      { value: "moderate", label: "Moderate", description: "Balanced depth across areas" },
      { value: "deep", label: "Deep Dive", description: "Exhaustive analysis of one area" },
    ],
  },
  {
    id: "format",
    label: "How should I deliver the feedback?",
    options: [
      { value: "interview", label: "Interview Style", description: "Q&A format, back and forth" },
      { value: "report", label: "Written Report", description: "Structured findings document" },
      { value: "code", label: "Code Examples", description: "Concrete before/after examples" },
    ],
  },
]

export const DialogGrillMe: Component = () => {
  const navigate = useNavigate()
  const sdk = useSDK()
  const prompt = usePrompt()
  const dialog = useDialog()
  const language = useLanguage()
  const [step, setStep] = createSignal(0)
  const [answers, setAnswers] = createSignal<Record<string, string>>({})
  const current = createMemo(() => questions[step()])
  const isLast = createMemo(() => step() >= questions.length - 1)

  function select(value: string) {
    setAnswers((prev) => ({ ...prev, [current().id]: value }))
    if (isLast()) {
      submit()
    } else {
      setStep((s) => s + 1)
    }
  }

  function back() {
    if (step() > 0) setStep((s) => s - 1)
  }

  function submit() {
    const parts = [
      `/grill-me`,
      `Scope: ${answers()["scope"] ?? "architecture"}`,
      `Depth: ${answers()["depth"] ?? "moderate"}`,
      `Format: ${answers()["format"] ?? "interview"}`,
      `\nConduct an interactive design interview focused on ${answers()["scope"] ?? "architecture"}.`,
      `Go ${answers()["depth"] ?? "moderate"} depth using ${answers()["format"] ?? "interview"} format.`,
      `Ask one question at a time and wait for my response before proceeding.`,
    ].join("\n")

    const dir = base64Encode(sdk.directory)
    dialog.close()
    prompt.set([{ type: "text", content: parts, start: 0, end: parts.length }], undefined, { dir })
    navigate(`/${dir}/session`)
  }

  return (
    <Dialog title="/grill-me — Interactive Design Interview" size="normal">
      <div class="flex flex-col gap-6 p-4">
        <div class="flex items-center gap-2 mb-2">
          <Show when={step() > 0}>
            <button
              type="button"
              class="flex items-center gap-1 text-[13px] text-v2-text-text-muted hover:text-v2-text-text-base transition-colors"
              onClick={back}
            >
              <Icon name="menu" size="small" />
              Back
            </button>
          </Show>
          <div class="flex gap-1.5 ml-auto">
            <For each={questions}>
              {(_, i) => (
                <div
                  class="h-1 rounded-full transition-all duration-300"
                  classList={{
                    "w-6 bg-v2-text-text-info": i() <= step(),
                    "w-2 bg-v2-border-border-weak": i() > step(),
                  }}
                />
              )}
            </For>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-[22px]">🔥</span>
            <h2 class="text-[17px] font-medium text-v2-text-text-base">{current().label}</h2>
          </div>
          <p class="text-[13px] text-v2-text-text-faint mt-1">
            Step {step() + 1} of {questions.length}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <For each={current().options}>
            {(option) => (
              <button
                type="button"
                class="flex flex-col gap-1 rounded-lg p-3 text-left transition-all duration-150 cursor-pointer"
                style={{
                  "background": "rgba(255,255,255,0.03)",
                  "border": "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                onClick={() => select(option.value)}
              >
                <div class="text-[13px] font-medium text-v2-text-text-base">{option.label}</div>
                <div class="text-[11px] leading-snug text-v2-text-text-faint">{option.description}</div>
              </button>
            )}
          </For>
        </div>
      </div>
    </Dialog>
  )
}
