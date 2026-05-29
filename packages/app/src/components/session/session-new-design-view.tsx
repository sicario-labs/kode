import type { JSX } from "solid-js"
import { createMemo } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { useServer } from "@/context/server"
import { useSync } from "@/context/sync"
import { base64Encode } from "@kode/core/util/encode"
import { getFilename } from "@kode/core/util/path"
import { Icon } from "@kode/ui/icon"
import { Select } from "@kode/ui/select"
import { WordmarkV2 } from "@kode/ui/v2/components/wordmark-v2.jsx"

const MAIN_WORKTREE = "main"

export function NewSessionDesignView(props: { worktree: string; children: JSX.Element }) {
  const globalSync = useGlobalSync()
  const layout = useLayout()
  const navigate = useNavigate()
  const sdk = useSDK()
  const server = useServer()
  const sync = useSync()

  const projectRoot = createMemo(() => (sync.project?.worktree ?? sdk.directory ?? "").replace(/\\/g, "/"))
  const projects = createMemo(() => {
    const roots = globalSync.data.project.map((project) => (project.worktree ?? "").replace(/\\/g, "/"))
    const currentRoot = projectRoot()
    if (roots.includes(currentRoot)) return roots
    return [currentRoot, ...roots].filter(Boolean)
  })
  const branch = createMemo(() => sync.data.vcs?.branch ?? MAIN_WORKTREE)

  const openProject = (directory: string | undefined) => {
    if (!directory) return
    const normalized = directory.replace(/\\/g, "/")
    if (normalized === projectRoot()) return
    layout.projects.open(normalized)
    server.projects.touch(normalized)
    navigate(`/${base64Encode(normalized)}/session`)
  }

  return (
    <div data-component="session-new-design" class="relative size-full overflow-hidden bg-v2-background-bg-base flex flex-col items-center justify-center px-6">
      <div class="w-full max-w-[640px] flex flex-col">
        {/* Project Selector with Folder Icon */}
        <div class="flex items-center gap-1.5 mb-2 pl-1 self-start">
          <Icon name="folder" size="small" class="text-v2-text-text-muted" />
          <Select
            size="normal"
            variant="ghost"
            options={[...projects(), "New Project", "Quick Start", "No Project"]}
            current={projectRoot()}
            label={(val) => {
              if (val === "New Project" || val === "Quick Start" || val === "No Project") return val
              return getFilename(val)
            }}
            onSelect={(val) => {
              if (val === "New Project") {
                layout.projects.open(projectRoot())
              } else if (val === "No Project" || val === "Quick Start") {
                // Custom select
              } else {
                openProject(val)
              }
            }}
            class="!p-0 !h-auto !bg-transparent hover:!bg-transparent text-[13px] font-medium text-v2-text-text-base border-0 cursor-pointer flex items-center gap-1"
            valueClass="font-medium text-v2-text-text-base text-[13px] !p-0"
          />
        </div>

        {/* Composer Input Box */}
        <div class="w-full">
          {props.children}
        </div>

        <div class="flex items-center gap-1.5 mt-2 pl-1 self-start">
          <svg class="size-3.5 text-v2-text-text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <Select
            size="normal"
            variant="ghost"
            options={["Local"]}
            current="Local"
            class="!p-0 !h-auto !bg-transparent hover:!bg-transparent text-[12px] font-medium text-v2-text-text-muted border-0 cursor-pointer flex items-center gap-1"
            valueClass="text-v2-text-text-muted font-medium text-[12px] !p-0"
          />
        </div>
      </div>
    </div>
  )
}
