import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { Tabs } from "@kode/ui/tabs"
import { IconButton } from "@kode/ui/icon-button"
import { TooltipKeybind } from "@kode/ui/tooltip"
import { ResizeHandle } from "@kode/ui/resize-handle"
import { Mark } from "@kode/ui/logo"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import type { SnapshotFileDiff, VcsFileDiff } from "@kode/sdk/v2"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { useDialog } from "@kode/ui/context/dialog"
import { Icon } from "@kode/ui/icon"
import { FileIcon } from "@kode/ui/file-icon"
import { useSDK } from "@/context/sdk"

import FileTree from "@/components/file-tree"
import { PreviewPanel } from "@/components/PreviewPanel"
import { SessionContextUsage } from "@/components/session-context-usage"
import { SessionContextTab, SortableTab, FileVisual } from "@/components/session"
import { AntigravityArtifactViewer } from "@/components/antigravity-artifacts"
import { useCommand } from "@/context/command"
import { useFile, type SelectedLineRange } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useSettings } from "@/context/settings"
import { useSync } from "@/context/sync"
import { createFileTabListSync } from "@/pages/session/file-tab-scroll"
import { FileTabContent } from "@/pages/session/file-tabs"
import { createOpenSessionFileTab, createSessionTabs, getTabReorderIndex, type Sizing } from "@/pages/session/helpers"
import { setSessionHandoff } from "@/pages/session/handoff"
import { useSessionLayout } from "@/pages/session/session-layout"

type RenderDiff = (SnapshotFileDiff & { file: string }) | VcsFileDiff

function renderDiff(value: SnapshotFileDiff | VcsFileDiff): value is RenderDiff {
  return typeof value.file === "string"
}

function formatArtifactName(path: string): string {
  const filename = path.replace(/^artifacts\//, "")
  if (filename.startsWith("media__")) {
    const match = filename.match(/media__(\d+)/)
    if (match) {
      const timestamp = parseInt(match[1], 10)
      const date = new Date(timestamp)
      const hours = date.getHours()
      const minutes = date.getMinutes().toString().padStart(2, "0")
      const ampm = hours >= 12 ? "PM" : "AM"
      const formattedHours = hours % 12 || 12
      return `Media (Today ${formattedHours}:${minutes} ${ampm})`
    }
    return "Media"
  }
  
  return filename
    .replace(/\.resolved(\.\d+)?$/, "")
    .replace(/\.md$/, "")
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function SessionSidePanel(props: {
  canReview: () => boolean
  diffs: () => (SnapshotFileDiff | VcsFileDiff)[]
  diffsReady: () => boolean
  empty: () => string
  hasReview: () => boolean
  reviewCount: () => number
  reviewPanel: () => JSX.Element
  activeDiff?: string
  focusReviewDiff: (path: string) => void
  reviewSnap: boolean
  size: Sizing
}) {
  const layout = useLayout()
  const platform = usePlatform()
  const settings = useSettings()
  const sync = useSync()
  const file = useFile()
  const sdk = useSDK()
  const language = useLanguage()
  const command = useCommand()
  const dialog = useDialog()
  const { sessionKey, tabs, view, params } = useSessionLayout()

  const isDesktop = createMediaQuery("(min-width: 768px)")
  const shown = createMemo(
    () =>
      platform.platform !== "desktop" ||
      import.meta.env.VITE_KODE_CHANNEL !== "beta" ||
      settings.general.showFileTree(),
  )

  const reviewOpen = createMemo(() => isDesktop() && view().reviewPanel.opened())
  const fileOpen = createMemo(() => isDesktop() && shown() && layout.fileTree.opened())
  const open = createMemo(() => reviewOpen() || fileOpen())
  const reviewTab = createMemo(() => isDesktop())
  const panelWidth = createMemo(() => {
    if (!open()) return "0px"
    if (reviewOpen()) return `calc(100% - ${layout.session.width()}px)`
    return `${layout.fileTree.width()}px`
  })
  const treeWidth = createMemo(() => (fileOpen() ? `${layout.fileTree.width()}px` : "0px"))

  const diffs = createMemo(() => props.diffs().filter(renderDiff))
  const diffFiles = createMemo(() => diffs().map((d) => d.file))
  const kinds = createMemo(() => {
    const merge = (a: "add" | "del" | "mix" | undefined, b: "add" | "del" | "mix") => {
      if (!a) return b
      if (a === b) return a
      return "mix" as const
    }

    const normalize = (p: string) => p.replaceAll("\\\\", "/").replace(/\/+$/, "")

    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of diffs()) {
      const file = normalize(diff.file)
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"

      out.set(file, kind)

      const parts = file.split("/")
      for (const [idx] of parts.slice(0, -1).entries()) {
        const dir = parts.slice(0, idx + 1).join("/")
        if (!dir) continue
        out.set(dir, merge(out.get(dir), kind))
      }
    }
    return out
  })

  const empty = (msg: string) => (
    <div class="h-full flex flex-col">
      <div class="h-6 shrink-0" aria-hidden />
      <div class="flex-1 pb-64 flex items-center justify-center text-center">
        <div class="text-12-regular text-text-weak">{msg}</div>
      </div>
    </div>
  )

  const nofiles = createMemo(() => {
    const state = file.tree.state("")
    if (!state?.loaded) return false
    return file.tree.children("").length === 0
  })

  const normalizeTab = (tab: string) => {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }

  const openReviewPanel = () => {
    if (!view().reviewPanel.opened()) view().reviewPanel.open()
  }

  const openTab = createOpenSessionFileTab({
    normalizeTab,
    openTab: tabs().open,
    pathFromTab: file.pathFromTab,
    loadFile: file.load,
    openReviewPanel,
    setActive: tabs().setActive,
  })

  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab,
    review: reviewTab,
    hasReview: props.canReview,
  })
  const contextOpen = tabState.contextOpen
  const openedTabs = tabState.openedTabs
  const activeTab = tabState.activeTab
  const activeFileTab = tabState.activeFileTab

  const fileTreeTab = () => layout.fileTree.tab()

  const setFileTreeTabValue = (value: string) => {
    if (value !== "changes" && value !== "all") return
    layout.fileTree.setTab(value)
  }

  const showAllFiles = () => {
    if (fileTreeTab() !== "changes") return
    layout.fileTree.setTab("all")
  }

  const [store, setStore] = createStore({
    activeDraggable: undefined as string | undefined,
  })

  const handleDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeDraggable", id)
  }

  const handleDragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (!draggable || !droppable) return

    const currentTabs = tabs().all()
    const toIndex = getTabReorderIndex(currentTabs, draggable.id.toString(), droppable.id.toString())
    if (toIndex === undefined) return
    tabs().move(draggable.id.toString(), toIndex)
  }

  const handleDragEnd = () => {
    setStore("activeDraggable", undefined)
  }

  createEffect(() => {
    if (!file.ready()) return

    setSessionHandoff(sessionKey(), {
      files: tabs()
        .all()
        .reduce<Record<string, SelectedLineRange | null>>((acc, tab) => {
          const path = file.pathFromTab(tab)
          if (!path) return acc

          const selected = file.selectedLines(path)
          acc[path] =
            selected && typeof selected === "object" && "start" in selected && "end" in selected
              ? (selected as SelectedLineRange)
              : null

          return acc
        }, {}),
    })
  })

  // Dynamic Artifacts list state
  const [artifactsList, setArtifactsList] = createSignal<{ name: string; path: string }[]>([])

  createEffect(() => {
    sync.data.message
    sdk.client.file
      .list({ path: "artifacts" })
      .then((res) => {
        if (res.data) {
          const formatted = res.data.map((item) => ({
            name: formatArtifactName(item.path),
            path: item.path,
          }))
          setArtifactsList(formatted)
        }
      })
      .catch(() => {})
  })

  // Live Preview Tunnel state sync
  const [tunnelUrl, setTunnelUrl] = createSignal("")

  createEffect(() => {
    let active = true
    const checkTunnel = () => {
      if (!active) return
      sdk.client.file
        .read({ path: ".kode/tunnel.json" })
        .then((res) => {
          if (!active) return
          if (res && res.data) {
            try {
              const data = JSON.parse(res.data.content)
              if (data && data.url) {
                setTunnelUrl(data.url)
              } else {
                setTunnelUrl("")
              }
            } catch (e) {
              setTunnelUrl("")
            }
          } else {
            setTunnelUrl("")
          }
        })
        .catch(() => {
          if (active) setTunnelUrl("")
        })
    }

    checkTunnel()
    const interval = setInterval(checkTunnel, 2500)

    onCleanup(() => {
      active = false
      clearInterval(interval)
    })
  })

  // Collapsible active subagents in session
  const subagents = createMemo(() => {
    const id = sessionKey()
    if (!id) return []
    return (sync.data.session ?? []).filter((s) => s.parentID === id && !s.time?.archived)
  })

  const getFileParts = (path: string) => {
    const parts = path.split("/")
    const filename = parts.pop() || ""
    const directory = parts.join("/")
    return { filename, directory }
  }

  const OverviewPanel = () => {
    const [subagentsOpen, setSubagentsOpen] = createSignal(true)
    const [filesOpen, setFilesOpen] = createSignal(true)
    const [artifactsOpen, setArtifactsOpen] = createSignal(true)
    const [tasksOpen, setTasksOpen] = createSignal(false)

    const [showAllFilesState, setShowAllFilesState] = createSignal(false)
    const [showAllArtifactsState, setShowAllArtifactsState] = createSignal(false)

    const visibleFiles = createMemo(() => {
      const all = diffFiles()
      if (showAllFilesState()) return all
      return all.slice(0, 5)
    })

    const visibleArtifacts = createMemo(() => {
      const all = artifactsList()
      if (showAllArtifactsState()) return all
      return all.slice(0, 5)
    })

    return (
      <div class="flex flex-col gap-6 text-[13px] text-v2-text-text-base pb-8 select-none">
        {/* SUBAGENTS */}
        <div class="flex flex-col gap-2">
          <button
            onClick={() => setSubagentsOpen(!subagentsOpen())}
            class="flex items-center gap-2 font-semibold text-[13px] text-v2-text-text-muted hover:text-v2-text-text-base bg-transparent border-0 p-0 text-left outline-none cursor-pointer"
          >
            <span>Subagents</span>
            <span class="px-1.5 py-0.5 rounded bg-v2-background-bg-muted text-[10px] font-bold text-v2-text-text-faint">
              {subagents().length}
            </span>
            <Icon name={subagentsOpen() ? "chevron-down" : "chevron-right"} size="small" class="opacity-60" />
          </button>

          <Show when={subagentsOpen()}>
            <div class="flex flex-col gap-1.5 mt-1 pl-1">
              <Show
                when={subagents().length > 0}
                fallback={<div class="text-[12px] text-v2-text-text-faint pl-2 py-1">No active subagents</div>}
              >
                <For each={subagents()}>
                  {(subagent) => {
                    const status = () => sync.data.session_status[subagent.id]
                    const statusType = () => {
                      const s = status()
                      return s && typeof s === "object" && "type" in s ? s.type : "idle"
                    }
                    const isRunning = () => {
                      const s = status()
                      return s ? s.type !== "idle" : false
                    }
                    return (
                      <div class="flex items-center justify-between p-2.5 bg-[#121212] hover:bg-[#161616] border border-[#222] rounded-lg transition-all group gap-2">
                        <div class="flex items-center gap-2 min-w-0 flex-1">
                          {/* Pulsing Status Icon */}
                          <div class="size-4 shrink-0 flex items-center justify-center relative">
                            <Show when={isRunning()} fallback={
                              <div class="size-2 rounded-full bg-[#0f9d58]" />
                            }>
                              <span class="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-[#1c78e3] opacity-75"></span>
                              <div class="size-2 rounded-full bg-[#1c78e3] relative z-10" />
                            </Show>
                          </div>
                          
                          <div class="flex flex-col min-w-0">
                            <span class="text-[12.5px] font-medium text-[#e3e3e3] group-hover:text-white transition-colors truncate">
                              {subagent.title?.replace(/\s+\(@[^)]+ subagent\)$/, "") || "Subagent Task"}
                            </span>
                            <span class="text-[10px] font-mono tracking-wider text-[#737373] capitalize mt-0.5">
                              {isRunning() ? "Running" : "Idle"} • {statusType()}
                            </span>
                          </div>
                        </div>
                        
                        <Show when={isRunning()}>
                          <button
                            type="button"
                            onClick={() => {
                              sdk.client.session.abort({ sessionID: subagent.id }).catch(() => {})
                            }}
                            class="size-6 bg-transparent hover:bg-red-950/20 border-none rounded-md cursor-pointer outline-none text-v2-icon-icon-muted hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Stop Subagent"
                          >
                            <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </Show>
                      </div>
                    )
                  }}
                </For>
              </Show>
            </div>
          </Show>
        </div>

        {/* FILES CHANGED */}
        <div class="flex flex-col gap-2">
          <button
            onClick={() => setFilesOpen(!filesOpen())}
            class="flex items-center gap-2 font-semibold text-[13px] text-v2-text-text-muted hover:text-v2-text-text-base bg-transparent border-0 p-0 text-left outline-none cursor-pointer"
          >
            <span>Files Changed</span>
            <span class="px-1.5 py-0.5 rounded bg-v2-background-bg-muted text-[10px] font-bold text-v2-text-text-faint">
              {diffFiles().length}
            </span>
            <Icon name={filesOpen() ? "chevron-down" : "chevron-right"} size="small" class="opacity-60" />
          </button>

          <Show when={filesOpen()}>
            <div class="flex flex-col gap-1 pl-1 mt-1">
              <Show
                when={diffFiles().length > 0}
                fallback={<div class="text-[12px] text-v2-text-text-faint pl-2 py-1">No file changes</div>}
              >
                <For each={visibleFiles()}>
                  {(file) => {
                    const { filename, directory } = getFileParts(file)
                    return (
                      <div
                        class="flex items-center gap-2 py-1.5 px-2 hover:bg-v2-background-bg-hover rounded-md cursor-pointer transition-colors group min-w-0"
                        onClick={() => props.focusReviewDiff(file)}
                      >
                        <FileIcon node={{ path: file, type: "file" }} class="size-4 shrink-0" />
                        <div class="flex items-baseline gap-2 min-w-0">
                          <span class="text-[13px] font-medium text-v2-text-text-base truncate shrink-0">{filename}</span>
                          <span class="text-[11px] text-v2-text-text-faint truncate">{directory}</span>
                        </div>
                      </div>
                    )
                  }}
                </For>

                <Show when={diffFiles().length > 5 && !showAllFilesState()}>
                  <button
                    onClick={() => setShowAllFilesState(true)}
                    class="text-[11px] font-medium text-v2-text-text-muted hover:text-v2-text-text-base bg-transparent border-0 p-1 pl-2 text-left cursor-pointer outline-none"
                  >
                    See all ({diffFiles().length})
                  </button>
                </Show>
              </Show>
            </div>
          </Show>
        </div>

        {/* ARTIFACTS */}
        <div class="flex flex-col gap-2">
          <button
            onClick={() => setArtifactsOpen(!artifactsOpen())}
            class="flex items-center gap-2 font-semibold text-[13px] text-v2-text-text-muted hover:text-v2-text-text-base bg-transparent border-0 p-0 text-left outline-none cursor-pointer"
          >
            <span>Artifacts</span>
            <span class="px-1.5 py-0.5 rounded bg-v2-background-bg-muted text-[10px] font-bold text-v2-text-text-faint">
              {artifactsList().length}
            </span>
            <Icon name={artifactsOpen() ? "chevron-down" : "chevron-right"} size="small" class="opacity-60" />
          </button>

          <Show when={artifactsOpen()}>
            <div class="flex flex-col gap-1 pl-1 mt-1">
              <Show
                when={artifactsList().length > 0}
                fallback={<div class="text-[12px] text-v2-text-text-faint pl-2 py-1">No artifacts generated</div>}
              >
                <For each={visibleArtifacts()}>
                  {(artifact) => {
                    const isImg = () => artifact.path.endsWith(".png") || artifact.path.includes("media__")
                    return (
                      <div
                        class="flex items-center gap-2.5 py-1.5 px-2 hover:bg-v2-background-bg-hover rounded-md cursor-pointer transition-colors group min-w-0"
                        onClick={() => openTab(file.tab(artifact.path))}
                      >
                        <Show
                          when={isImg()}
                          fallback={
                            <svg class="size-4 text-v2-icon-icon-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                          }
                        >
                          <svg class="size-4 text-v2-icon-icon-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </Show>
                        <span class="text-[13px] font-medium text-v2-text-text-base truncate">{artifact.name}</span>
                      </div>
                    )
                  }}
                </For>

                <Show when={artifactsList().length > 5 && !showAllArtifactsState()}>
                  <button
                    onClick={() => setShowAllArtifactsState(true)}
                    class="text-[11px] font-medium text-v2-text-text-muted hover:text-v2-text-text-base bg-transparent border-0 p-1 pl-2 text-left cursor-pointer outline-none"
                  >
                    See all ({artifactsList().length})
                  </button>
                </Show>
              </Show>
            </div>
          </Show>
        </div>

        {/* BACKGROUND TASKS */}
        <div class="flex flex-col gap-2">
          <button
            onClick={() => setTasksOpen(!tasksOpen())}
            class="flex items-center gap-2 font-semibold text-[13px] text-v2-text-text-muted hover:text-v2-text-text-base bg-transparent border-0 p-0 text-left outline-none cursor-pointer"
          >
            <span>Background Tasks</span>
            <span class="px-1.5 py-0.5 rounded bg-v2-background-bg-muted text-[10px] font-bold text-v2-text-text-faint">
              0
            </span>
            <Icon name={tasksOpen() ? "chevron-down" : "chevron-right"} size="small" class="opacity-60" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <Show when={isDesktop() && !(import.meta.env.VITE_KODE_CHANNEL !== "prod" && !params.id)}>
      <aside
        id="review-panel"
        aria-label={language.t("session.panel.reviewAndFiles")}
        aria-hidden={!open()}
        inert={!open()}
        class="relative min-w-0 h-full flex shrink-0 overflow-hidden bg-background-base"
        classList={{
          "pointer-events-none": !open(),
          "transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
            !props.size.active() && !props.reviewSnap,
        }}
        style={{ width: panelWidth() }}
      >
        <Show when={open()}>
          <div class="size-full flex border-l border-border-weaker-base">
            <div
              aria-hidden={!reviewOpen()}
              inert={!reviewOpen()}
              class="relative min-w-0 h-full flex-1 overflow-hidden bg-background-base"
              classList={{
                "pointer-events-none": !reviewOpen(),
              }}
            >
              <div class="size-full min-w-0 h-full bg-background-base">
                <DragDropProvider
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  collisionDetector={closestCenter}
                >
                  <DragDropSensors />
                  <ConstrainDragYAxis />
                  <Tabs value={activeTab()} onChange={openTab}>
                    <div class="sticky top-0 shrink-0 flex">
                      <Tabs.List
                        ref={(el: HTMLDivElement) => {
                          const stop = createFileTabListSync({ el, contextOpen })
                          onCleanup(stop)
                        }}
                      >
                        <Show when={reviewTab()}>
                          <Tabs.Trigger value="review" class="flex items-center gap-1.5 font-medium px-3 py-1.5 rounded">
                            <div class="flex items-center gap-1.5">
                              <Icon name="menu" size="small" class="opacity-70" />
                              <div>Overview</div>
                            </div>
                          </Tabs.Trigger>
                          <Tabs.Trigger value="preview" class="flex items-center gap-1.5 font-medium px-3 py-1.5 rounded">
                            <div class="flex items-center gap-1.5">
                              <Icon name="eye" size="small" class="opacity-70" />
                              <div>Live Preview</div>
                            </div>
                          </Tabs.Trigger>
                        </Show>
                        <Show when={contextOpen()}>
                          <Tabs.Trigger
                            value="context"
                            closeButton={
                              <TooltipKeybind
                                title={language.t("common.closeTab")}
                                keybind={command.keybind("tab.close")}
                                placement="bottom"
                                gutter={10}
                              >
                                <IconButton
                                  icon="close-small"
                                  variant="ghost"
                                  class="h-5 w-5"
                                  onClick={() => tabs().close("context")}
                                  aria-label={language.t("common.closeTab")}
                                />
                              </TooltipKeybind>
                            }
                            hideCloseButton
                            onMiddleClick={() => tabs().close("context")}
                          >
                            <div class="flex items-center gap-2">
                              <SessionContextUsage variant="indicator" />
                              <div>{language.t("session.tab.context")}</div>
                            </div>
                          </Tabs.Trigger>
                        </Show>
                        <SortableProvider ids={openedTabs()}>
                          <For each={openedTabs()}>{(tab) => <SortableTab tab={tab} onTabClose={tabs().close} />}</For>
                        </SortableProvider>
                        <div class="bg-background-stronger h-full shrink-0 sticky right-0 z-10 flex items-center justify-center pr-3">
                          <TooltipKeybind
                            title={language.t("command.file.open")}
                            keybind={command.keybind("file.open")}
                            class="flex items-center"
                          >
                            <IconButton
                              icon="plus-small"
                              variant="ghost"
                              iconSize="large"
                              class="!rounded-md"
                              onClick={() => {
                                void import("@/components/dialog-select-file").then((x) => {
                                  dialog.show(() => <x.DialogSelectFile mode="files" onOpenFile={showAllFiles} />)
                                })
                              }}
                              aria-label={language.t("command.file.open")}
                            />
                          </TooltipKeybind>
                        </div>
                      </Tabs.List>
                    </div>

                    <Show when={reviewTab()}>
                      <Tabs.Content value="review" class="flex flex-col h-full overflow-y-auto contain-strict bg-v2-background-bg-deep p-4 text-v2-text-text-base no-scrollbar">
                        <Show when={activeTab() === "review"}>
                          <OverviewPanel />
                        </Show>
                      </Tabs.Content>
                      <Tabs.Content value="preview" class="flex flex-col h-full overflow-hidden contain-strict bg-v2-background-bg-deep text-v2-text-text-base">
                        <Show when={activeTab() === "preview"}>
                          <PreviewPanel tunnelUrl={tunnelUrl()} />
                        </Show>
                      </Tabs.Content>
                    </Show>

                    <Tabs.Content value="empty" class="flex flex-col h-full overflow-hidden contain-strict">
                      <Show when={activeTab() === "empty"}>
                        <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                          <div class="h-full px-6 pb-42 -mt-4 flex flex-col items-center justify-center text-center gap-6">
                            <Mark class="w-14 opacity-10" />
                            <div class="text-14-regular text-text-weak max-w-56">
                              {language.t("session.files.selectToOpen")}
                            </div>
                          </div>
                        </div>
                      </Show>
                    </Tabs.Content>

                    <Show when={contextOpen()}>
                      <Tabs.Content value="context" class="flex flex-col h-full overflow-hidden contain-strict">
                        <Show when={activeTab() === "context"}>
                          <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                            <SessionContextTab />
                          </div>
                        </Show>
                      </Tabs.Content>
                    </Show>

                    <Show when={activeFileTab()} keyed>
                      {(tab) => <FileTabContent tab={tab} />}
                    </Show>
                  </Tabs>
                  <DragOverlay>
                    <Show when={store.activeDraggable} keyed>
                      {(tab) => {
                        const path = file.pathFromTab(tab)
                        return (
                          <div data-component="tabs-drag-preview">
                            <Show when={path}>{(p) => <FileVisual active path={p()} />}</Show>
                          </div>
                        )
                      }}
                    </Show>
                  </DragOverlay>
                </DragDropProvider>
              </div>
            </div>

            <Show when={shown()}>
              <div
                id="file-tree-panel"
                aria-hidden={!fileOpen()}
                inert={!fileOpen()}
                class="relative min-w-0 h-full shrink-0 overflow-hidden"
                classList={{
                  "pointer-events-none": !fileOpen(),
                  "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
                    !props.size.active(),
                }}
                style={{ width: treeWidth() }}
              >
                <div
                  class="h-full flex flex-col overflow-hidden group/filetree"
                  classList={{ "border-l border-border-weaker-base": reviewOpen() }}
                >
                  <Tabs
                    variant="pill"
                    value={fileTreeTab()}
                    onChange={setFileTreeTabValue}
                    class="h-full"
                    data-scope="filetree"
                  >
                    <Tabs.List>
                      <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
                        {props.reviewCount()}{" "}
                        {language.t(
                          props.reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other",
                        )}
                      </Tabs.Trigger>
                      <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
                        {language.t("session.files.all")}
                      </Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="changes" class="bg-background-stronger px-3 py-0">
                      <Switch>
                        <Match when={props.hasReview() || !props.diffsReady()}>
                          <Show
                            when={props.diffsReady()}
                            fallback={
                              <div class="px-2 py-2 text-12-regular text-text-weak">
                                {language.t("common.loading")}
                                {language.t("common.loading.ellipsis")}
                              </div>
                            }
                          >
                            <FileTree
                              path=""
                              class="pt-3"
                              allowed={diffFiles()}
                              kinds={kinds()}
                              draggable={false}
                              active={props.activeDiff}
                              onFileClick={(node) => props.focusReviewDiff(node.path)}
                            />
                          </Show>
                        </Match>
                      </Switch>
                    </Tabs.Content>
                    <Tabs.Content value="all" class="bg-background-stronger px-3 py-0">
                      <Switch>
                        <Match when={nofiles()}>{empty(language.t("session.files.empty"))}</Match>
                        <Match when={true}>
                          <FileTree
                            path=""
                            class="pt-3"
                            modified={diffFiles()}
                            kinds={kinds()}
                            onFileClick={(node) => openTab(file.tab(node.path))}
                          />
                        </Match>
                      </Switch>
                    </Tabs.Content>
                  </Tabs>
                </div>
                <Show when={fileOpen()}>
                  <div onPointerDown={() => props.size.start()}>
                    <ResizeHandle
                      direction="horizontal"
                      edge="start"
                      size={layout.fileTree.width()}
                      min={200}
                      max={480}
                      onResize={(width) => {
                        props.size.touch()
                        layout.fileTree.resize(width)
                      }}
                    />
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </aside>
    </Show>
  )
}
