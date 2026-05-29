import { showToastV2, type ToastV2Options } from "@kode/ui/v2/components/toast-v2.jsx"
import type { JSX } from "solid-js"

export interface EphemeralOptions {
  title?: string
  description?: string
  icon?: JSX.Element
  duration?: number
}

const DEFAULT_DURATION = 4000

function show(options: EphemeralOptions | string) {
  const opts: ToastV2Options = typeof options === "string"
    ? { description: options, duration: DEFAULT_DURATION }
    : { ...options, duration: options.duration ?? DEFAULT_DURATION }
  return showToastV2(opts)
}

function success(description: string, title?: string) {
  return showToastV2({ title, description, duration: DEFAULT_DURATION })
}

function error(description: string, title?: string) {
  return showToastV2({ title, description, duration: DEFAULT_DURATION * 1.5 })
}

function info(description: string, title?: string) {
  return showToastV2({ title, description, duration: DEFAULT_DURATION })
}

export const ephemeral = { show, success, error, info }
