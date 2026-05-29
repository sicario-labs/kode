import { createSignal, Show, For, onMount } from "solid-js"
import { ButtonV2 } from "@kode/ui/v2/components/button-v2.jsx"
import { WordmarkV2 } from "@kode/ui/v2/components/wordmark-v2.jsx"
import { useSettings } from "@/context/settings"

const slides = [
  {
    title: "Welcome to Kode",
    subtitle: "The Agentic Mission Control",
    description:
      "Kode isn't just another AI code generator. It's a contrarian architecture that replaces generate-and-pray with a structured Plan → Verify → Apply workflow. Every change is intentional.",
    emoji: "⚡",
    gradient: "from-blue-500/20 to-violet-500/20",
    glow: "shadow-[0_0_80px_rgba(99,102,241,0.15)]",
  },
  {
    title: "Verification First",
    subtitle: "No Blind Code Execution",
    description:
      "Every generated solution passes through strict validation gates — checking syntax, imports, and architectural soundness — before it ever touches your codebase. You stay in control.",
    emoji: "🛡️",
    gradient: "from-emerald-500/20 to-teal-500/20",
    glow: "shadow-[0_0_80px_rgba(16,185,129,0.15)]",
  },
  {
    title: "Ghost Branches",
    subtitle: "Zero-Risk Experimentation",
    description:
      "Agents do their deep thinking and testing inside isolated Ghost Branches. Review their progress, inspect mutations, and merge confidently — your main branch stays pristine.",
    emoji: "👻",
    gradient: "from-purple-500/20 to-pink-500/20",
    glow: "shadow-[0_0_80px_rgba(168,85,247,0.15)]",
  },
  {
    title: "Subagent Fleets",
    subtitle: "Specialized Parallel Work",
    description:
      "Stop waiting on a single monolithic prompt. Kode delegates to specialized subagents — Codebase Researcher, Test Oracle, Database Debugger — all running concurrently in their own tracks.",
    emoji: "🚀",
    gradient: "from-amber-500/20 to-orange-500/20",
    glow: "shadow-[0_0_80px_rgba(245,158,11,0.15)]",
  },
]

export function OnboardingCarousel() {
  const settings = useSettings()
  const [currentSlide, setCurrentSlide] = createSignal(0)
  const [mounted, setMounted] = createSignal(false)

  onMount(() => {
    requestAnimationFrame(() => setMounted(true))
  })

  const isLast = () => currentSlide() === slides.length - 1

  const next = () => {
    if (isLast()) {
      settings.general.setOnboardingCompleted(true)
    } else {
      setCurrentSlide((s) => s + 1)
    }
  }

  const prev = () => {
    if (currentSlide() > 0) setCurrentSlide((s) => s - 1)
  }

  return (
    <div
      class="fixed inset-0 z-[999] flex items-center justify-center transition-opacity duration-500"
      classList={{
        "opacity-0": !mounted(),
        "opacity-100": mounted(),
      }}
      style={{ "background": "rgba(0, 0, 0, 0.85)", "backdrop-filter": "blur(12px)" }}
    >
      <div
        class="relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] transition-transform duration-500"
        classList={{
          "scale-95": !mounted(),
          "scale-100": mounted(),
        }}
        style={{
          "width": "min(820px, 90vw)",
          "height": "min(540px, 85vh)",
          "background": "linear-gradient(180deg, rgba(24, 24, 32, 0.98) 0%, rgba(12, 12, 18, 0.99) 100%)",
          "box-shadow": "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
        }}
      >
        {/* Header */}
        <div class="flex h-14 shrink-0 items-center justify-between px-7" style={{ "border-bottom": "1px solid rgba(255,255,255,0.06)" }}>
          <div class="w-24">
            <WordmarkV2 class="h-5 w-auto opacity-40" />
          </div>
          <div class="flex items-center gap-2">
            <For each={slides}>
              {(_, i) => (
                <button
                  class="h-1.5 rounded-full transition-all duration-400 cursor-pointer"
                  classList={{
                    "w-8 bg-white/80": currentSlide() === i(),
                    "w-4 bg-white/15 hover:bg-white/25": currentSlide() !== i(),
                  }}
                  onClick={() => setCurrentSlide(i())}
                />
              )}
            </For>
          </div>
          <div class="w-24 text-right">
            <button
              class="text-[13px] font-medium text-white/35 hover:text-white/70 transition-colors duration-200 cursor-pointer"
              onClick={() => settings.general.setOnboardingCompleted(true)}
            >
              Skip
            </button>
          </div>
        </div>

        {/* Slide Content */}
        <div class="relative flex-1 overflow-hidden">
          <For each={slides}>
            {(s, i) => (
              <div
                class="absolute inset-0 flex flex-col items-center justify-center px-16 text-center transition-all duration-500 ease-out"
                classList={{
                  "opacity-100 translate-x-0": currentSlide() === i(),
                  "opacity-0 translate-x-16": currentSlide() < i(),
                  "opacity-0 -translate-x-16": currentSlide() > i(),
                }}
                style={{ "pointer-events": currentSlide() === i() ? "auto" : "none" }}
              >
                {/* Emoji Icon */}
                <div
                  class={`mb-8 flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br ${s.gradient} ${s.glow} transition-all duration-500`}
                  style={{ "border": "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span class="text-4xl" style={{ "filter": "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>{s.emoji}</span>
                </div>

                {/* Title */}
                <h2
                  class="mb-2 text-[26px] font-semibold tracking-tight"
                  style={{ color: "rgba(255,255,255,0.95)" }}
                >
                  {s.title}
                </h2>

                {/* Subtitle */}
                <h3
                  class="mb-6 text-[15px] font-medium tracking-wide uppercase"
                  style={{ color: "rgba(255,255,255,0.35)", "letter-spacing": "0.08em" }}
                >
                  {s.subtitle}
                </h3>

                {/* Description */}
                <p
                  class="max-w-[460px] text-[15px] leading-[1.7]"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  {s.description}
                </p>
              </div>
            )}
          </For>
        </div>

        {/* Footer */}
        <div
          class="flex h-20 shrink-0 items-center justify-between px-7"
          style={{ "border-top": "1px solid rgba(255,255,255,0.06)" }}
        >
          <div style={{ "min-width": "100px" }}>
            <Show when={currentSlide() > 0}>
              <button
                class="text-[14px] font-medium text-white/40 hover:text-white/80 transition-colors duration-200 cursor-pointer"
                onClick={prev}
              >
                ← Back
              </button>
            </Show>
          </div>
          <div class="text-[13px] text-white/20">
            {currentSlide() + 1} / {slides.length}
          </div>
          <div style={{ "min-width": "100px", "text-align": "right" }}>
            <button
              class="rounded-lg px-6 py-2.5 text-[14px] font-semibold transition-all duration-200 cursor-pointer"
              style={{
                "background": "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)",
                "color": "rgba(255,255,255,0.9)",
                "border": "1px solid rgba(255,255,255,0.1)",
                "box-shadow": "0 2px 8px rgba(0,0,0,0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)"
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"
                e.currentTarget.style.transform = "translateY(-1px)"
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)"
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)"
              }}
              onClick={next}
            >
              {isLast() ? "Get Started →" : "Continue →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
