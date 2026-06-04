import { createMemo, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useTheme } from "../../context/theme"
import { useSync } from "../../context/sync"
import { useDirectory } from "../../context/directory"
import { useConnected } from "../../component/use-connected"
import { createStore } from "solid-js/store"
import { useRoute } from "../../context/route"
import { useLocal } from "../../context/local"
import { Global } from "@kode/core/global"
import { Chip, StatusBar } from "../../component/kode-ui"

export function Footer() {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const local = useLocal()
  const mcp = createMemo(() => Object.values(sync.data.mcp).filter((x) => x.status === "connected").length)
  const mcpError = createMemo(() => Object.values(sync.data.mcp).some((x) => x.status === "failed"))
  const lsp = createMemo(() => Object.keys(sync.data.lsp))
  const permissions = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.permission[route.data.sessionID] ?? []
  })
  const directory = useDirectory()
  const connected = useConnected()

  const dirDisplay = createMemo(() => {
    const d = (directory() || process.cwd()).replace(Global.Path.home, "~")
    return d
  })

  const modelDisplay = createMemo(() => {
    const m = local.model.current()
    if (!m) return "—"
    return `${m.providerID}/${m.modelID}`
  })

  const [store, setStore] = createStore({
    welcome: false,
  })

  onMount(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []
    function tick() {
      if (connected()) return
      if (!store.welcome) {
        setStore("welcome", true)
        timeouts.push(setTimeout(() => tick(), 5000))
        return
      }
      if (store.welcome) {
        setStore("welcome", false)
        timeouts.push(setTimeout(() => tick(), 10_000))
        return
      }
    }
    timeouts.push(setTimeout(() => tick(), 10_000))
    onCleanup(() => {
      timeouts.forEach(clearTimeout)
    })
  })

  return (
    <StatusBar>
      <Chip label="◉" tone="primary" />
      <text fg={theme.text}>{dirDisplay()}</text>
      <Show when={sync.data.vcs?.branch}>
        <text fg={theme.secondary}>:{sync.data.vcs?.branch}</text>
      </Show>
      <text fg={theme.border}>│</text>
      <Chip label="▢" value={modelDisplay()} tone="default" />
      <Chip label="◇" value={`0/3`} tone="warn" />
      <Show when={connected()}>
        <Chip label="⏱" value="—" />
        <Chip label="⛁" value="$0.000" />
        <Show when={permissions().length > 0}>
          <Chip label="△" value={`${permissions().length}`} tone="warn" />
        </Show>
        <Show when={lsp().length > 0}>
          <Chip label="•" value={`${lsp().length} LSP`} tone={lsp().length > 0 ? "ok" : "muted"} />
        </Show>
        <Show when={mcp()}>
          <Chip
            label="⊙"
            value={`${mcp()} MCP`}
            tone={mcpError() ? "err" : mcp() > 0 ? "ok" : "muted"}
          />
        </Show>
        <text fg={theme.textMuted}>/status</text>
      </Show>
      <Show when={!connected()}>
        <Switch>
          <Match when={store.welcome}>
            <text fg={theme.text}>
              Get started <span style={{ fg: theme.textMuted }}>/connect</span>
            </text>
          </Match>
        </Switch>
      </Show>
    </StatusBar>
  )
}
