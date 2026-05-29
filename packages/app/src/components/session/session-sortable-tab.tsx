import { createMemo, Show } from "solid-js"
import type { JSX } from "solid-js"
import { createSortable } from "@thisbeyond/solid-dnd"
import { FileIcon } from "@kode/ui/file-icon"
import { IconButton } from "@kode/ui/icon-button"
import { TooltipKeybind } from "@kode/ui/tooltip"
import { Tabs } from "@kode/ui/tabs"
import { Icon } from "@kode/ui/icon"
import { getFilename } from "@kode/core/util/path"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useCommand } from "@/context/command"

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

export function FileVisual(props: { path: string; active?: boolean }): JSX.Element {
  const isArtifact = () => props.path.startsWith("artifacts/")
  const isImg = () => props.path.endsWith(".png") || props.path.includes("media__")
  const displayName = () => isArtifact() ? formatArtifactName(props.path) : getFilename(props.path)

  return (
    <div class="flex items-center gap-x-1.5 min-w-0">
      <Show when={isArtifact()} fallback={
        <Show
          when={!props.active}
          fallback={<FileIcon node={{ path: props.path, type: "file" }} class="size-4 shrink-0" />}
        >
          <span class="relative inline-flex size-4 shrink-0">
            <FileIcon node={{ path: props.path, type: "file" }} class="absolute inset-0 size-4 tab-fileicon-color" />
            <FileIcon node={{ path: props.path, type: "file" }} mono class="absolute inset-0 size-4 tab-fileicon-mono" />
          </span>
        </Show>
      }>
        <Show when={isImg()} fallback={
          <svg class="size-4 text-v2-icon-icon-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        }>
          <svg class="size-4 text-v2-icon-icon-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </Show>
      </Show>
      <span class="text-14-medium truncate">{displayName()}</span>
    </div>
  )
}

export function SortableTab(props: { tab: string; onTabClose: (tab: string) => void }): JSX.Element {
  const file = useFile()
  const language = useLanguage()
  const command = useCommand()
  const sortable = createSortable(props.tab)
  const path = createMemo(() => file.pathFromTab(props.tab))
  const content = createMemo(() => {
    const value = path()
    if (!value) return
    return <FileVisual path={value} />
  })
  return (
    <div use:sortable class="h-full flex items-center" classList={{ "opacity-0": sortable.isActiveDraggable }}>
      <div class="relative">
        <Tabs.Trigger
          value={props.tab}
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
                onClick={() => props.onTabClose(props.tab)}
                aria-label={language.t("common.closeTab")}
              />
            </TooltipKeybind>
          }
          hideCloseButton
          onMiddleClick={() => props.onTabClose(props.tab)}
        >
          <Show when={content()}>{(value) => value()}</Show>
        </Tabs.Trigger>
      </div>
    </div>
  )
}
