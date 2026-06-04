import type { TuiPlugin, TuiPluginApi } from "@kode/plugin/tui"
import type { InternalTuiPlugin } from "../../plugin/internal"
import { createMemo, Match, Show, Switch } from "solid-js"
import { Global } from "@kode/core/global"
import { Chip, StatusBar } from "../../component/kode-ui"

const id = "internal:home-footer"

function Directory(props: { api: TuiPluginApi }) {
  const dir = createMemo(() => {
    const dir = props.api.state.path.directory || process.cwd()
    const out = dir.replace(Global.Path.home, "~")
    const branch = props.api.state.vcs?.branch
    if (branch) return out + ":" + branch
    return out
  })
  return <Chip label="◉" value={dir()} tone="primary" />
}

function Mcp(props: { api: TuiPluginApi }) {
  const list = createMemo(() => props.api.state.mcp())
  const has = createMemo(() => list().length > 0)
  const err = createMemo(() => list().some((item) => item.status === "failed"))
  const count = createMemo(() => list().filter((item) => item.status === "connected").length)

  return (
    <Show when={has()}>
      <Chip
        label="⊙"
        value={`${count()} MCP`}
        tone={err() ? "err" : count() > 0 ? "ok" : "muted"}
      />
    </Show>
  )
}

function Version(props: { api: TuiPluginApi }) {
  return <Chip label="v" value={props.api.app.version} tone="muted" />
}

function View(props: { api: TuiPluginApi }) {
  return (
    <StatusBar>
      <Directory api={props.api} />
      <Mcp api={props.api} />
      <box flexGrow={1} />
      <Version api={props.api} />
    </StatusBar>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      home_footer() {
        return <View api={api} />
      },
    },
  })
}

const plugin: InternalTuiPlugin = {
  id,
  tui,
}

export default plugin
