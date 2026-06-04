import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createEffect, createSignal, onMount } from "solid-js"
import { Logo } from "../component/logo"
import { MissionDeck } from "../component/kode-ui"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { useDirectory } from "../context/directory"
import { TuiPluginRuntime } from "@/cli/cmd/tui/plugin/runtime"
import { useEditorContext } from "@tui/context/editor"
import { Global } from "@kode/core/global"

let once = false
const placeholder = {
  normal: [
    "Verify file via 4-gate check",
    "Execute a Plan-Critique-Generate loop",
    "Run code golfing benchmarks",
    "Check blast radius of a patch",
    "Explain task graph architecture",
  ],
  shell: [
    "kode verify --input internal/gateway/server.go",
    "kode stats",
    "kode run \"fix syntax error\"",
  ],
}

export function Home() {
  const sync = useSync()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const [ref, setRef] = createSignal<PromptRef | undefined>()
  const args = useArgs()
  const local = useLocal()
  const editor = useEditorContext()
  const directory = useDirectory()
  let sent = false

  onMount(() => {
    editor.clearSelection()
  })

  const bind = (r: PromptRef | undefined) => {
    setRef(r)
    promptRef.set(r)
    if (once || !r) return
    if (route.prompt) {
      r.set(route.prompt)
      once = true
      return
    }
    if (!args.prompt) return
    r.set({ input: args.prompt, parts: [] })
    once = true
  }

  createEffect(() => {
    const r = ref()
    if (sent) return
    if (!r) return
    if (!sync.ready || !local.model.ready) return
    if (!args.prompt) return
    if (r.current.input !== args.prompt) return
    sent = true
    r.submit()
  })

  const dirDisplay = () => {
    const d = (directory() || process.cwd()).replace(Global.Path.home, "~")
    return d
  }

  return (
    <>
      <box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />
        <box flexShrink={0}>
          <TuiPluginRuntime.Slot name="home_logo" mode="replace">
            <Logo />
          </TuiPluginRuntime.Slot>
        </box>
        <box height={1} minHeight={0} flexShrink={1} />
        <box width="100%" maxWidth={92} flexShrink={0} marginBottom={1}>
          <MissionDeck
            directory={dirDisplay()}
            branch={sync.data.vcs?.branch ?? undefined}
            agent={local.agent.current()?.name}
            model={(() => {
              const m = local.model.current()
              if (!m) return undefined
              return `${m.providerID}/${m.modelID}`
            })()}
            blastRadius={0}
            blastLimit={3}
            tokensUsed={undefined}
            costUSD={undefined}
            budgetUSD={1.5}
            lastVerifyStatus="NONE"
          />
        </box>
        <box width="100%" maxWidth={75} zIndex={1000} paddingTop={1} flexShrink={0}>
          <TuiPluginRuntime.Slot name="home_prompt" mode="replace" ref={bind}>
            <Prompt ref={bind} right={<TuiPluginRuntime.Slot name="home_prompt_right" />} placeholders={placeholder} />
          </TuiPluginRuntime.Slot>
        </box>
        <TuiPluginRuntime.Slot name="home_bottom" />
        <box flexGrow={1} minHeight={0} />
        <Toast />
      </box>
      <box width="100%" flexShrink={0}>
        <TuiPluginRuntime.Slot name="home_footer" mode="single_winner" />
      </box>
    </>
  )
}
