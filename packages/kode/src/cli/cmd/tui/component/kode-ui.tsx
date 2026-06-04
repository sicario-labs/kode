import { For, Show, createMemo, type JSX } from "solid-js"
import { useTheme } from "../context/theme"

export type KodeStage = "plan" | "critique" | "generate" | "verify"

export const STAGE_ORDER: KodeStage[] = ["plan", "critique", "generate", "verify"]

export const STAGE_LABEL: Record<KodeStage, string> = {
  plan: "PLAN",
  critique: "CRITIQUE",
  generate: "GENERATE",
  verify: "VERIFY",
}

export const STAGE_GLYPH: Record<KodeStage, string> = {
  plan: "◐",
  critique: "◇",
  generate: "▶",
  verify: "✓",
}

export type Intent = "chat" | "simple-edit" | "code-task" | "multi-step"

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase()
  const hasCode = /```|\b\w+\.(ts|tsx|go|py|rs|js|jsx|json|md)\b/i.test(text)
  const hasFileRef = /[`'"][^`'"]*\.[a-z]{1,5}[`'"]|\b\w+\/\w+\b/i.test(text)
  const imperative = /\b(fix|refactor|build|add|implement|migrate|debug|change|update|rewrite|remove|delete|rename)\b/i.test(t)
  const multi = /\b(refactor|migrate|redesign|architect|build\s+\w+|plan\s+\w+)\b/i.test(t)
  const isQuestion = /\?$/.test(text.trim()) && !imperative
  if (!hasCode && !hasFileRef && !imperative && isQuestion) return "chat"
  if (multi || text.length > 400) return "multi-step"
  if (hasFileRef || hasCode) return "code-task"
  if (imperative) return "simple-edit"
  return "chat"
}

export const INTENT_STAGES: Record<Intent, KodeStage[]> = {
  chat: [],
  "simple-edit": ["generate", "verify"],
  "code-task": ["plan", "generate", "verify"],
  "multi-step": ["plan", "critique", "generate", "verify"],
}

export function StageBar(props: {
  stages?: KodeStage[] | undefined
  current?: KodeStage | undefined
  compact?: boolean
}) {
  const { theme } = useTheme()
  const items = createMemo(() => {
    const list = props.stages ?? STAGE_ORDER
    return STAGE_ORDER.filter((s) => list.includes(s))
  })
  const isActive = (s: KodeStage) => props.current === s
  const isDone = (s: KodeStage) => {
    if (!props.current) return false
    const order = items()
    const currentIdx = order.indexOf(props.current)
    const stageIdx = order.indexOf(s)
    return currentIdx >= 0 && stageIdx >= 0 && stageIdx < currentIdx
  }
  return (
    <Show when={items().length > 0}>
      <box
        flexDirection="row"
        alignItems="center"
        gap={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={props.compact ? 0 : 1}
        paddingBottom={props.compact ? 0 : 1}
        flexShrink={0}
      >
        <text fg={theme.textMuted}>PIPELINE</text>
        <text fg={theme.border}>{`─`}</text>
        <For each={items()}>
          {(stage, idx) => {
            const color = () => {
              if (isActive(stage)) return theme.primary
              if (isDone(stage)) return theme.success
              return theme.textMuted
            }
            const glyph = () => {
              if (isActive(stage)) return STAGE_GLYPH[stage]
              if (isDone(stage)) return "✓"
              return "·"
            }
            return (
              <>
                <Show when={idx() > 0}>
                  <text fg={theme.border}>{`──`}</text>
                </Show>
                <text fg={color()}>
                  <span style={{ fg: color() }}>{glyph()}</span> {STAGE_LABEL[stage]}
                </text>
              </>
            )
          }}
        </For>
      </box>
    </Show>
  )
}

export function Chip(props: {
  label: string
  value?: string | number | undefined
  tone?: "default" | "primary" | "warn" | "ok" | "err" | "muted"
}) {
  const { theme } = useTheme()
  const tone = () => props.tone ?? "default"
  const fg = () => {
    switch (tone()) {
      case "primary":
        return theme.primary
      case "warn":
        return theme.warning
      case "ok":
        return theme.success
      case "err":
        return theme.error
      case "muted":
        return theme.textMuted
      default:
        return theme.text
    }
  }
  return (
    <box
      border={["top", "bottom"]}
      customBorderChars={{ topLeft: " ", bottomLeft: " ", topRight: " ", bottomRight: " ", vertical: "│", horizontal: "─", topT: "┬", bottomT: "┴", cross: "┼", leftT: "├", rightT: "┤" }}
      borderColor={theme.border}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
      gap={1}
      flexShrink={0}
    >
      <text fg={theme.textMuted}>{props.label}</text>
      <Show when={props.value !== undefined}>
        <text fg={fg()}>{props.value}</text>
      </Show>
    </box>
  )
}

export function StatusBar(props: { children: JSX.Element }) {
  const { theme } = useTheme()
  return (
    <box
      flexDirection="row"
      alignItems="center"
      gap={1}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexShrink={0}
      backgroundColor={theme.backgroundPanel}
    >
      {props.children}
    </box>
  )
}

export type ToolVerdict = "ok" | "err" | "pending" | "denied" | "skipped"

export const VERDICT_GLYPH: Record<ToolVerdict, string> = {
  ok: "✓",
  err: "✗",
  pending: "⋯",
  denied: "⊘",
  skipped: "↷",
}

export function StatusCard(props: {
  icon: string
  tool: string
  target: string
  duration?: string | undefined
  verdict: ToolVerdict
  children?: JSX.Element
  onClick?: (() => void) | undefined
  meta?: string | undefined
}) {
  const { theme } = useTheme()
  const verdictColor = () => {
    switch (props.verdict) {
      case "ok":
        return theme.success
      case "err":
        return theme.error
      case "denied":
        return theme.warning
      case "skipped":
        return theme.textMuted
      case "pending":
        return theme.primary
    }
  }
  const verdictLabel = () => {
    switch (props.verdict) {
      case "ok":
        return "OK"
      case "err":
        return "ERR"
      case "denied":
        return "DENY"
      case "skipped":
        return "SKIP"
      case "pending":
        return "RUN"
    }
  }
  return (
    <box
      flexDirection="row"
      alignItems="center"
      gap={1}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={0}
      paddingBottom={0}
      flexShrink={0}
      onMouseUp={() => props.onClick?.()}
    >
      <text fg={verdictColor()}>{VERDICT_GLYPH[props.verdict]}</text>
      <text fg={theme.textMuted}>{`│`}</text>
      <text fg={theme.primary}>{props.icon}</text>
      <text fg={theme.textMuted}>{props.tool}</text>
      <text fg={theme.text}>{props.target}</text>
      <box flexGrow={1} flexShrink={1} />
      <Show when={props.meta}>
        <text fg={theme.textMuted}>{props.meta}</text>
      </Show>
      <Show when={props.duration}>
        <text fg={theme.textMuted}>{props.duration}</text>
      </Show>
      <text fg={verdictColor()} attributes={props.verdict === "err" || props.verdict === "denied" ? 1 : 0}>
        {verdictLabel()}
      </text>
    </box>
  )
}

export function GatedFrame(props: {
  label: string
  subtitle?: string | undefined
  tone?: "default" | "warn" | "ok" | "err"
  children: JSX.Element
}) {
  const { theme } = useTheme()
  const tone = () => props.tone ?? "default"
  const accent = () => {
    switch (tone()) {
      case "warn":
        return theme.warning
      case "ok":
        return theme.success
      case "err":
        return theme.error
      default:
        return theme.primary
    }
  }
  return (
    <box
      border={["left", "right", "top", "bottom"]}
      customBorderChars={{
        topLeft: "╔",
        topRight: "╗",
        bottomLeft: "╚",
        bottomRight: "╝",
        vertical: "║",
        horizontal: "═",
        topT: "╤",
        bottomT: "╧",
        cross: "╪",
        leftT: "╟",
        rightT: "╢",
      }}
      borderColor={accent()}
      flexDirection="column"
      flexShrink={0}
    >
      <box
        flexDirection="row"
        alignItems="center"
        gap={1}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={theme.backgroundPanel}
      >
        <text fg={accent()}>▣ GATE</text>
        <text fg={accent()}>·</text>
        <text fg={theme.text}>{props.label}</text>
        <Show when={props.subtitle}>
          <text fg={theme.textMuted}>· {props.subtitle}</text>
        </Show>
      </box>
      <box paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
        {props.children}
      </box>
    </box>
  )
}

export function GateResult(props: {
  passed: number
  total: number
  gates?: string[] | undefined
  failed?: string[] | undefined
}) {
  const { theme } = useTheme()
  const allOk = () => props.failed === undefined || props.failed.length === 0
  const accent = () => (allOk() ? theme.success : theme.error)
  return (
    <box
      flexDirection="row"
      alignItems="center"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      flexShrink={0}
    >
      <text fg={accent()}>{allOk() ? "✓" : "✗"}</text>
      <text fg={theme.text}>GATE RESULT</text>
      <text fg={theme.textMuted}>·</text>
      <text fg={accent()}>
        {props.passed}/{props.total} PASS
      </text>
      <Show when={props.gates && props.gates.length > 0}>
        <text fg={theme.textMuted}>·</text>
        <text fg={theme.textMuted}>{props.gates!.join(" · ")}</text>
      </Show>
      <Show when={!allOk() && props.failed && props.failed.length > 0}>
        <text fg={theme.textMuted}>·</text>
        <text fg={theme.error}>failed: {props.failed!.join(", ")}</text>
      </Show>
    </box>
  )
}

export function MissionDeck(props: {
  directory?: string | undefined
  branch?: string | undefined
  model?: string | undefined
  agent?: string | undefined
  blastRadius?: number | undefined
  blastLimit?: number | undefined
  tokensUsed?: number | undefined
  tokensLimit?: number | undefined
  costUSD?: number | undefined
  budgetUSD?: number | undefined
  lastVerifyStatus?: "PASS" | "FAIL" | "SKIP" | "NONE"
  lastVerifyGates?: number | undefined
  lastVerifyTotal?: number | undefined
}) {
  const { theme } = useTheme()
  const fmtTokens = (n?: number) => {
    if (n === undefined) return "—"
    if (n < 1000) return `${n}`
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
    return `${(n / 1_000_000).toFixed(2)}M`
  }
  const fmtUSD = (n?: number) => (n === undefined ? "—" : `$${n.toFixed(3)}`)
  const verifyBadge = createMemo(() => {
    switch (props.lastVerifyStatus) {
      case "PASS":
        return { fg: theme.success, text: `PASS ${props.lastVerifyGates}/${props.lastVerifyTotal ?? 7}` }
      case "FAIL":
        return { fg: theme.error, text: `FAIL ${props.lastVerifyGates ?? 0}/${props.lastVerifyTotal ?? 7}` }
      case "SKIP":
        return { fg: theme.textMuted, text: "SKIP" }
      default:
        return { fg: theme.textMuted, text: "—" }
    }
  })
  return (
    <box
      flexDirection="column"
      border={["top", "bottom", "left", "right"]}
      customBorderChars={{
        topLeft: "┌",
        topRight: "┐",
        bottomLeft: "└",
        bottomRight: "┘",
        vertical: "│",
        horizontal: "─",
        topT: "┬",
        bottomT: "┴",
        cross: "┼",
        leftT: "├",
        rightT: "┤",
      }}
      borderColor={theme.border}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor={theme.backgroundPanel}
      flexShrink={0}
      width="100%"
    >
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.primary}>◆ MISSION DECK</text>
        <text fg={theme.textMuted}>·</text>
        <text fg={theme.text}>{props.directory ?? "—"}</text>
        <Show when={props.branch}>
          <text fg={theme.secondary}>:{props.branch}</text>
        </Show>
        <text fg={theme.textMuted}>·</text>
        <text fg={theme.text}>{props.agent ?? "build"}</text>
        <text fg={theme.textMuted}>·</text>
        <text fg={theme.textMuted}>{props.model ?? "—"}</text>
      </box>
      <box flexDirection="row" alignItems="center" gap={2} paddingTop={1}>
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.textMuted}>BLAST</text>
          <text fg={theme.warning}>
            {props.blastRadius ?? 0}/{props.blastLimit ?? 3}
          </text>
        </box>
        <text fg={theme.border}>│</text>
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.textMuted}>TOKENS</text>
          <text fg={theme.text}>{fmtTokens(props.tokensUsed)}</text>
          <Show when={props.tokensLimit}>
            <text fg={theme.textMuted}>/{fmtTokens(props.tokensLimit)}</text>
          </Show>
        </box>
        <text fg={theme.border}>│</text>
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.textMuted}>COST</text>
          <text fg={theme.text}>{fmtUSD(props.costUSD)}</text>
          <Show when={props.budgetUSD}>
            <text fg={theme.textMuted}>/{fmtUSD(props.budgetUSD)}</text>
          </Show>
        </box>
        <text fg={theme.border}>│</text>
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.textMuted}>VERIFY</text>
          <text fg={verifyBadge().fg}>{verifyBadge().text}</text>
        </box>
      </box>
    </box>
  )
}
