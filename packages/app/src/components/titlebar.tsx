import { createEffect, createMemo, For, mapArray, Match, Show, startTransition, Switch, untrack } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useLocation, useMatch, useNavigate, useParams } from "@solidjs/router"
import { IconButton } from "@kode/ui/icon-button"
import { Icon } from "@kode/ui/icon"
import { Button } from "@kode/ui/button"
import { Tooltip, TooltipKeybind } from "@kode/ui/tooltip"
import { useTheme } from "@kode/ui/theme/context"
import { IconButtonV2 } from "@kode/ui/v2/components/icon-button-v2.jsx"
import { Icon as IconV2 } from "@kode/ui/v2/components/icon.jsx"

import { getAvatarColors, useLayout, type LocalProject } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
import { WindowsAppMenu } from "./windows-app-menu"
import { DESKTOP_MENU, desktopMenuVisible } from "@/desktop-menu"
import { DropdownMenu } from "@kode/ui/dropdown-menu"
import { applyPath, backPath, forwardPath } from "./titlebar-history"
import { useGlobalSync } from "@/context/global-sync"
import { decodeDirectory } from "@/pages/directory-layout"
import { iife } from "@kode/core/util/iife"
import { base64Encode } from "@kode/core/util/encode"
import { Avatar as AvatarV2 } from "@kode/ui/v2/components/avatar-v2.jsx"
import { displayName, getProjectAvatarSource, projectForSession } from "@/pages/layout/helpers"
import { makeEventListener } from "@solid-primitives/event-listener"
import { StatusPopover } from "./status-popover"
import { SDKProvider } from "@/context/sdk"

type TauriDesktopWindow = {
  startDragging?: () => Promise<void>
  toggleMaximize?: () => Promise<void>
}

type TauriThemeWindow = {
  setTheme?: (theme?: "light" | "dark" | null) => Promise<void>
}

type TauriApi = {
  window?: {
    getCurrentWindow?: () => TauriDesktopWindow
  }
  webviewWindow?: {
    getCurrentWebviewWindow?: () => TauriThemeWindow
  }
}

const tauriApi = () => (window as unknown as { __TAURI__?: TauriApi }).__TAURI__
const currentDesktopWindow = () => tauriApi()?.window?.getCurrentWindow?.()
const currentThemeWindow = () => tauriApi()?.webviewWindow?.getCurrentWebviewWindow?.()
const legacyTitlebarHeight = 40
const v2TitlebarHeight = 44
const minTitlebarZoom = 0.25
const windowsControlsBaseWidth = 138 // 3 native Windows caption buttons at 46px each.
const USE_V2_TITLEBAR = import.meta.env.VITE_KODE_CHANNEL !== "prod"

const makeSessionHref = (b64Dir: string, sessionId: string) => `/${b64Dir}/session/${sessionId}`

export type TitlebarUpdate = {
  version: () => string | undefined
  installing: () => boolean
  install: () => void
}

export function Titlebar(props: { update?: TitlebarUpdate }) {
  const layout = useLayout()
  const platform = usePlatform()
  const command = useCommand()
  const language = useLanguage()
  const settings = useSettings()
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  const mac = createMemo(() => platform.platform === "desktop" && platform.os === "macos")
  const windows = createMemo(() => platform.platform === "desktop" && platform.os === "windows")
  const electronWindows = createMemo(() => windows() && !tauriApi())
  const linux = createMemo(() => platform.platform === "desktop" && platform.os === "linux")
  const web = createMemo(() => platform.platform === "web")
  const zoom = () => platform.webviewZoom?.() ?? 1
  const titlebarZoom = () => (windows() ? Math.max(zoom(), minTitlebarZoom) : zoom())
  const counterZoom = () => (windows() && titlebarZoom() < 1 ? 1 / titlebarZoom() : 1)
  const minHeight = () => {
    const height = USE_V2_TITLEBAR ? v2TitlebarHeight : legacyTitlebarHeight
    if (mac()) return `${height / zoom()}px`
    if (windows()) return `${height / Math.min(titlebarZoom(), 1)}px`
    return undefined
  }
  const windowsControlsWidth = () => `${windowsControlsBaseWidth / Math.max(titlebarZoom(), 1)}px`

  const [history, setHistory] = createStore({
    stack: [] as string[],
    index: 0,
    action: undefined as "back" | "forward" | undefined,
  })

  const path = () => `${location.pathname}${location.search}${location.hash}`
  const creating = createMemo(() => {
    if (!params.dir) return false
    if (params.id) return false
    const parts = location.pathname.replace(/\/+$/, "").split("/")
    return parts.at(-1) === "session"
  })

  createEffect(() => {
    const current = path()

    untrack(() => {
      const next = applyPath(history, current)
      if (next === history) return
      setHistory(next)
    })
  })

  const canBack = createMemo(() => history.index > 0)
  const canForward = createMemo(() => history.index < history.stack.length - 1)
  const hasProjects = createMemo(() => layout.projects.list().length > 0)
  const nav = createMemo(() => import.meta.env.VITE_KODE_CHANNEL !== "beta" || settings.general.showNavigation())

  const back = () => {
    const next = backPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to)
  }

  const forward = () => {
    const next = forwardPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to)
  }

  command.register(() => [
    {
      id: "common.goBack",
      title: language.t("common.goBack"),
      category: language.t("command.category.view"),
      keybind: "mod+[",
      onSelect: back,
    },
    {
      id: "common.goForward",
      title: language.t("common.goForward"),
      category: language.t("command.category.view"),
      keybind: "mod+]",
      onSelect: forward,
    },
  ])

  const getWin = () => {
    if (platform.platform !== "desktop") return
    return currentDesktopWindow()
  }

  createEffect(() => {
    if (platform.platform !== "desktop") return

    const scheme = theme.colorScheme()
    const value = scheme === "system" ? null : scheme

    const win = currentThemeWindow()
    if (!win?.setTheme) return

    void win.setTheme(value).catch(() => undefined)
  })

  const interactive = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false

    const selector =
      "button, a, input, textarea, select, option, [role='button'], [role='menuitem'], [contenteditable='true'], [contenteditable='']"

    return !!target.closest(selector)
  }

  const drag = (e: MouseEvent) => {
    if (platform.platform !== "desktop") return
    if (e.buttons !== 1) return
    if (interactive(e.target)) return

    const win = getWin()
    if (!win?.startDragging) return

    e.preventDefault()
    void win.startDragging().catch(() => undefined)
  }

  const maximize = (e: MouseEvent) => {
    if (platform.platform !== "desktop") return
    if (interactive(e.target)) return
    if (e.target instanceof Element && e.target.closest("[data-tauri-decorum-tb]")) return

    const win = getWin()
    if (!win?.toggleMaximize) return

    e.preventDefault()
    void win.toggleMaximize().catch(() => undefined)
  }

  return (
    <header
      classList={{
        "shrink-0 relative overflow-hidden flex flex-row": true,
        "h-11 bg-v2-background-bg-deep border-b border-v2-border-border-muted": USE_V2_TITLEBAR,
        "h-10 bg-background-base": !USE_V2_TITLEBAR,
      }}
      style={{
        "min-height": minHeight(),
        "padding-left": mac() ? `${84 / zoom()}px` : 0,
        width: electronWindows() ? `env(titlebar-area-width, calc(100vw - ${windowsControlsWidth()}))` : undefined,
        "max-width": electronWindows()
          ? `env(titlebar-area-width, calc(100vw - ${windowsControlsWidth()}))`
          : undefined,
        "align-self": electronWindows() ? "flex-start" : undefined,
      }}
      data-tauri-drag-region
      onMouseDown={drag}
      onDblClick={maximize}
    >
      <Switch>
        <Match when={USE_V2_TITLEBAR}>
          {(_) => {
            const globalSync = useGlobalSync()
            const navigate = useNavigate()
            const homeMatch = useMatch(() => "/")

            const TitlebarMenuDropdown = (props: {
              menuId: string
              label: string
              class?: string
            }) => {
              const menu = () => DESKTOP_MENU.find((m) => m.id === props.menuId)
              
              const commandDisabled = (id: string) => {
                const option = command.options.find((option) => option.id === id)
                if (!option) return true
                return option.disabled ?? false
              }
              
              const runCommand = (id: string) => {
                if (commandDisabled(id)) return
                command.trigger(id)
              }
              
              const runAction = (action: any) => {
                void platform.runDesktopMenuAction?.(action)
              }
              
              const runEntry = (entry: any) => {
                if (entry.type === "separator") return
                if (entry.command) {
                  runCommand(entry.command)
                  return
                }
                if (entry.action) {
                  runAction(entry.action)
                  return
                }
                if (entry.href) platform.openLink(entry.href)
              }

              return (
                <DropdownMenu gutter={4} modal={false} placement="bottom-start">
                  <DropdownMenu.Trigger class={props.class}>
                    {props.label}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content class="desktop-app-menu bg-v2-background-bg-deep border border-v2-border-border-muted rounded-lg p-1 min-w-[160px] text-v2-text-text-base z-50">
                      <For each={menu()?.items?.filter((entry) => desktopMenuVisible(entry, "windows"))}>
                        {(entry) =>
                          entry.type === "separator" ? (
                            <DropdownMenu.Separator class="h-[1px] bg-v2-border-border-muted my-1" />
                          ) : (
                            <DropdownMenu.Item
                              disabled={entry.command ? commandDisabled(entry.command) : false}
                              onSelect={() => runEntry(entry)}
                              class="px-2.5 py-1.5 text-[12.5px] rounded hover:bg-v2-overlay-simple-overlay-hover cursor-pointer flex items-center justify-between text-v2-text-text-muted data-[disabled]:opacity-40 data-[disabled]:pointer-events-none"
                            >
                              <DropdownMenu.ItemLabel>{entry.label ?? entry.role}</DropdownMenu.ItemLabel>
                              <Show when={entry.command ? command.keybind(entry.command) : entry.accelerator?.windows}>
                                <span class="text-[10px] text-v2-text-text-faint font-sans ml-4">
                                  {entry.command ? command.keybind(entry.command) : entry.accelerator?.windows}
                                </span>
                              </Show>
                            </DropdownMenu.Item>
                          )
                        }
                      </For>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu>
              )
            }

            const newSessionHref = () => {
              if (params.dir) return `/${params.dir}/session`

              const project = layout.projects.list()[0]
              if (!project) return "/"

              return `/${base64Encode(project.worktree)}/session`
            }

            type Tab = { dir: string; sessionId: string; href: string }

            const [tabsStore, tabsStoreActions] = iife(() => {
              const [store, setStore] = createStore<Tab[]>(
                iife(() => {
                  if (!params.dir || !params.id) return []
                  return [
                    {
                      dir: decodeDirectory(params.dir) ?? "",
                      sessionId: params.id,
                      href: makeSessionHref(params.dir, params.id),
                    },
                  ]
                }),
              )

              const actions = {
                addTab: (tab: Tab) => {
                  setStore(
                    produce((tabs) => {
                      if (tabs.some((t) => t.href === tab.href)) return

                      tabs.push(tab)
                    }),
                  )
                },
                removeTab: (href: string) => {
                  startTransition(() => {
                    setStore(
                      produce((tabs) => {
                        const index = tabs.findIndex((t) => t.href === href)
                        if (index === -1) return
                        tabs.splice(index, 1)
                        const nextTab = tabs[index] ?? tabs[tabs.length - 1]
                        if (nextTab) navigate(nextTab.href)
                        else navigate("/")
                      }),
                    )
                  })
                },
              }

              return [store, actions]
            })

            createEffect(() => {
              const params = useParams()
              if (!(params.dir && params.id)) return

              tabsStoreActions.addTab({
                dir: decodeDirectory(params.dir) ?? "",
                sessionId: params.id,
                href: makeSessionHref(params.dir, params.id),
              })
            })

            const projects = createMemo(() => layout.projects.list())
            const projectByID = createMemo(
              () => new Map(projects().flatMap((project) => (project.id ? [[project.id, project] as const] : []))),
            )

            const currentSessionTab = () => {
              if (!params.dir || !params.id) return
              const href = makeSessionHref(params.dir, params.id)
              return tabsStore.find((tab) => tab.href === href)
            }

            const closeCurrentSessionTab = () => {
              const tab = currentSessionTab()
              if (!tab) return false
              tabsStoreActions.removeTab(tab.href)
              return true
            }

            const closeNewSessionTab = () => {
              if (!(params.dir && !params.id)) return false
              const last = tabsStore[tabsStore.length - 1]
              if (last) navigate(last.href)
              else navigate("/")
              return true
            }

            makeEventListener(
              document,
              "keydown",
              (event) => {
                if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
                if (event.key.toLowerCase() !== "w") return
                if (!(closeCurrentSessionTab() || closeNewSessionTab())) return

                event.preventDefault()
                event.stopPropagation()
              },
              { capture: true },
            )

            command.register(() => {
              const commands = [
                {
                  id: `tab.prev`,
                  category: "tab",
                  title: "",
                  keybind: `mod+option+ArrowLeft`,
                  hidden: true,
                  onSelect: () => {
                    let index = tabsStore.findIndex((tab) => tab.href === currentSessionTab()?.href)
                    if (index === -1) return

                    index -= 1
                    if (index === -1) index = tabsStore.length - 1

                    const next = tabsStore[index]
                    if (next) navigate(next.href)
                  },
                },
                {
                  id: `tab.next`,
                  category: "tab",
                  title: "",
                  keybind: `mod+option+ArrowRight`,
                  hidden: true,
                  onSelect: () => {
                    let index = tabsStore.findIndex((tab) => tab.href === currentSessionTab()?.href)
                    if (index === -1) return

                    index += 1
                    if (index === tabsStore.length) index = 0

                    const next = tabsStore[index]
                    if (next) navigate(next.href)
                  },
                },
                ...Array.from({ length: 9 }, (_, i) => {
                  const index = i
                  const number = index + 1
                  return {
                    id: `tab.${number}`,
                    category: "tab",
                    title: "",
                    keybind: `mod+${number}`,
                    disabled: layout.projects.list().length <= index,
                    hidden: true,
                    onSelect: () => {
                      const tab = tabsStore[index]
                      if (tab) navigate(tab.href)
                    },
                  }
                }),
              ]

              return commands
            })

            const tabsEnriched = iife(() => {
              const base = mapArray(
                () => tabsStore,
                (tab) => {
                  const sync = globalSync.createDirSyncContext(tab.dir)
                  const session = sync.session.get(tab.sessionId)
                  return session ? { ...tab, info: session } : null
                },
              )

              return () => base().flatMap((s) => (s ? [s] : []))
            })

            return (
              <div
                class="h-full flex-1 flex flex-row items-center gap-1.5 pr-3 py-2"
                classList={{
                  "pl-2": mac(),
                  "pl-4": !mac(),
                }}
              >
                <Show when={!layout.sidebar.opened()}>
                  <button
                    type="button"
                    onClick={() => layout.sidebar.toggle()}
                    class="text-v2-text-text-muted hover:text-v2-text-text-base bg-transparent border-0 p-0 cursor-pointer flex items-center justify-center transition-colors mr-2 ml-1"
                    title="Show Sidebar"
                  >
                    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                    </svg>
                  </button>
                </Show>

                <div class="flex items-center gap-4 px-2 select-none mr-4">
                  <TitlebarMenuDropdown menuId="app" label="Kode" class="text-[12px] font-semibold text-v2-text-text-accent cursor-pointer hover:opacity-80 bg-transparent border-0 p-0" />
                  <TitlebarMenuDropdown menuId="file" label="File" class="text-[12px] font-medium text-v2-text-text-muted cursor-pointer hover:text-v2-text-text-base bg-transparent border-0 p-0" />
                  <TitlebarMenuDropdown menuId="view" label="View" class="text-[12px] font-medium text-v2-text-text-muted cursor-pointer hover:text-v2-text-text-base bg-transparent border-0 p-0" />
                  <TitlebarMenuDropdown menuId="window" label="Window" class="text-[12px] font-medium text-v2-text-text-muted cursor-pointer hover:text-v2-text-text-base bg-transparent border-0 p-0" />
                </div>

                <div class="flex-1" />
                <Show when={windows() && !electronWindows()}>
                  <div data-tauri-decorum-tb class="flex flex-row" />
                </Show>
              </div>
            )
          }}
        </Match>
        <Match when>
          <div
            class="grid h-full min-h-full w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center"
            style={{ zoom: counterZoom() }}
          >
            <div
              classList={{
                "flex items-center min-w-0": true,
                "pl-2": !mac(),
              }}
            >
              <Show when={windows() || linux()}>
                <WindowsAppMenu command={command} platform={platform} />
              </Show>
              <Show when={mac()}>
                {/*<div class="h-full shrink-0" style={{ width: `${72 / zoom()}px` }} />*/}
                <div class="xl:hidden w-10 shrink-0 flex items-center justify-center">
                  <IconButton
                    icon="menu"
                    variant="ghost"
                    class="titlebar-icon rounded-md"
                    onClick={layout.mobileSidebar.toggle}
                    aria-label={language.t("sidebar.menu.toggle")}
                    aria-expanded={layout.mobileSidebar.opened()}
                  />
                </div>
              </Show>
              <Show when={!mac()}>
                <div class="xl:hidden w-[48px] shrink-0 flex items-center justify-center">
                  <IconButton
                    icon="menu"
                    variant="ghost"
                    class="titlebar-icon rounded-md"
                    onClick={layout.mobileSidebar.toggle}
                    aria-label={language.t("sidebar.menu.toggle")}
                    aria-expanded={layout.mobileSidebar.opened()}
                  />
                </div>
              </Show>
              <div class="flex items-center gap-1 shrink-0">
                <TooltipKeybind
                  class={web() ? "hidden xl:flex shrink-0 ml-14" : "hidden xl:flex shrink-0 ml-2"}
                  placement="bottom"
                  title={language.t("command.sidebar.toggle")}
                  keybind={command.keybind("sidebar.toggle")}
                >
                  <Button
                    variant="ghost"
                    class="group/sidebar-toggle titlebar-icon w-8 h-6 p-0 box-border"
                    onClick={layout.sidebar.toggle}
                    aria-label={language.t("command.sidebar.toggle")}
                    aria-expanded={layout.sidebar.opened()}
                  >
                    <Icon size="small" name={layout.sidebar.opened() ? "sidebar-active" : "sidebar"} />
                  </Button>
                </TooltipKeybind>
                <div class="hidden xl:flex items-center shrink-0">
                  <Show when={params.dir}>
                    <div
                      class="flex items-center shrink-0 w-8 mr-1"
                      aria-hidden={layout.sidebar.opened() ? "true" : undefined}
                    >
                      <div
                        class="transition-opacity"
                        classList={{
                          "opacity-100 duration-120 ease-out": !layout.sidebar.opened(),
                          "opacity-0 duration-120 ease-in delay-0 pointer-events-none": layout.sidebar.opened(),
                        }}
                      >
                        <TooltipKeybind
                          placement="bottom"
                          title={language.t("command.session.new")}
                          keybind={command.keybind("session.new")}
                          openDelay={2000}
                        >
                          <Button
                            variant="ghost"
                            icon={creating() ? "new-session-active" : "new-session"}
                            class="titlebar-icon w-8 h-6 p-0 box-border"
                            disabled={layout.sidebar.opened()}
                            tabIndex={layout.sidebar.opened() ? -1 : undefined}
                            onClick={() => {
                              if (!params.dir) return
                              navigate(`/${params.dir}/session`)
                            }}
                            aria-label={language.t("command.session.new")}
                            aria-current={creating() ? "page" : undefined}
                          />
                        </TooltipKeybind>
                      </div>
                    </div>
                  </Show>
                  <div
                    class="flex items-center shrink-0"
                    classList={{
                      "-translate-x-[36px]": layout.sidebar.opened() && !!params.dir,
                      "duration-180 ease-out": !layout.sidebar.opened(),
                      "duration-180 ease-in": layout.sidebar.opened(),
                    }}
                  >
                    <Show when={hasProjects() && nav()}>
                      <div class="flex items-center gap-0 transition-transform">
                        <Tooltip placement="bottom" value={language.t("common.goBack")} openDelay={2000}>
                          <Button
                            variant="ghost"
                            icon="chevron-left"
                            class="titlebar-icon w-6 h-6 p-0 box-border"
                            disabled={!canBack()}
                            onClick={back}
                            aria-label={language.t("common.goBack")}
                          />
                        </Tooltip>
                        <Tooltip placement="bottom" value={language.t("common.goForward")} openDelay={2000}>
                          <Button
                            variant="ghost"
                            icon="chevron-right"
                            class="titlebar-icon w-6 h-6 p-0 box-border"
                            disabled={!canForward()}
                            onClick={forward}
                            aria-label={language.t("common.goForward")}
                          />
                        </Tooltip>
                      </div>
                    </Show>
                    <div id="kode-titlebar-left" class="flex items-center gap-3 min-w-0 px-2" />
                    <ChannelIndicator />
                  </div>
                </div>
              </div>
            </div>

            <div class="min-w-0 flex items-center justify-center pointer-events-none">
              <div
                id="kode-titlebar-center"
                class="pointer-events-auto min-w-0 flex justify-center w-fit max-w-full"
              />
            </div>

            <div
              classList={{
                "flex items-center min-w-0 justify-end": true,
                "pr-2": !windows(),
              }}
              data-tauri-drag-region
              onMouseDown={drag}
            >
              <div id="kode-titlebar-right" class="flex items-center gap-1 shrink-0 justify-end" />
              <Show when={windows()}>
                {!tauriApi() && <div class="shrink-0" style={{ width: windowsControlsWidth() }} />}
                <div data-tauri-decorum-tb class="flex flex-row" />
              </Show>
            </div>
          </div>
        </Match>
      </Switch>
    </header>
  )
}

function TitlebarUpdatePill(props: { update?: TitlebarUpdate }) {
  const language = useLanguage()
  const version = () => props.update?.version()

  return (
    <Show when={version() !== undefined}>
      <button
        type="button"
        class="h-5 shrink-0 rounded-[27px] bg-[var(--v2-background-bg-accent)] px-2.5 text-[11px] font-[530] leading-[1.1] tracking-[-0.04px] text-[var(--v2-text-text-contrast)] disabled:opacity-60"
        onClick={() => props.update?.install()}
        disabled={props.update?.installing()}
        aria-label={language.t("toast.update.action.installRestart")}
        title={version() ? `Update ${version()}` : undefined}
      >
        Update
      </button>
    </Show>
  )
}

function DesktopTitlebarIconButton(props: Parameters<typeof IconButtonV2>[0]) {
  return
}

function TabNavItem(props: {
  href: string
  title: string
  project?: LocalProject
  directory: string
  hideClose?: boolean
  onClose: () => void
}) {
  const match = useMatch(() => props.href)
  const isActive = () => !!match()
  const navigate = useNavigate()
  return (
    <div
      class="group relative flex h-7 min-w-24 max-w-60 flex-row items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[6px] bg-[var(--tab-bg)] pl-1.5 [--tab-bg:var(--v2-background-bg-deep)] hover:[--tab-bg:var(--v2-background-bg-layer-02)] data-[active='true']:[--tab-bg:var(--v2-background-bg-layer-02)]"
      data-active={isActive()}
    >
      <a
        href={props.href}
        class="flex h-full min-w-0 flex-1 flex-row items-center gap-1.5 overflow-hidden text-[13px] font-medium text-v2-text-text-faint group-data-[active='true']:text-v2-text-text-base"
        onClick={(e) => {
          e.preventDefault()
          navigate(props.href)
        }}
      >
        <ProjectTabAvatar project={props.project} directory={props.directory} />
        <span class="text-clip">{props.title}</span>
      </a>

      <div class="absolute right-0 inset-y-0 flex flex-row items-center pr-1 py-1 w-8 pl-2">
        <div
          class="absolute inset-0 bg-(image:--inactive-bg) group-hover:bg-(image:--active-bg) group-data-[active=true]:bg-(image:--active-bg)"
          style={{
            "--inactive-bg": "linear-gradient(to right, transparent 0%, var(--tab-bg) 80%)",
            "--active-bg": "linear-gradient(90deg, transparent 0%, var(--tab-bg) 25%)",
          }}
        />
        <IconButtonV2
          size="small"
          variant="ghost-muted"
          class="opacity-0 group-hover:opacity-100 group-data-[active='true']:opacity-100"
          onClick={props.onClose}
          icon={<IconV2 name="xmark-small" />}
        />
      </div>
    </div>
  )
}

function ProjectTabAvatar(props: { project?: LocalProject; directory: string }) {
  return (
    <AvatarV2
      fallback={displayName(props.project ?? { worktree: props.directory })}
      src={getProjectAvatarSource(props.project?.id, props.project?.icon)}
      kind="org"
      size="small"
      {...getAvatarColors(props.project?.icon?.color)}
      class="size-4 rounded"
    />
  )
}

function NewSessionTabItem(props: { href: string; title: string; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div class="group relative flex h-7 max-w-60 flex-row items-center gap-1.5 overflow-hidden rounded-[6px] bg-[var(--v2-overlay-simple-overlay-pressed)] pl-1.5 pr-8 whitespace-nowrap focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--v2-border-border-focus)]">
      <a
        href={props.href}
        aria-current="page"
        class="flex h-full min-w-0 flex-1 flex-row items-center gap-1.5 overflow-hidden text-[13px] font-medium leading-none text-[var(--v2-text-text-base)]"
        onClick={(e) => {
          e.preventDefault()
          navigate(props.href)
        }}
      >
        <span class="flex size-4 shrink-0 rotate-90 items-center justify-center">
          <IconV2 name="edit" />
        </span>
        <span class="truncate">{props.title}</span>
      </a>
      <div class="absolute right-0 inset-y-0 flex w-7 items-center justify-center">
        <IconButtonV2
          size="small"
          variant="ghost-muted"
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            props.onClose()
          }}
          icon={<IconV2 name="xmark-small" />}
          aria-label="Close tab"
        />
      </div>
    </div>
  )
}

function ChannelIndicator() {
  return (
    <>
      {["beta", "dev"].includes(import.meta.env.VITE_KODE_CHANNEL) && (
        <div class="bg-icon-interactive-base text-[#FFF] font-medium px-2 rounded-sm uppercase font-mono">
          {import.meta.env.VITE_KODE_CHANNEL.toUpperCase()}
        </div>
      )}
    </>
  )
}
