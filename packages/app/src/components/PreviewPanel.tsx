import { createSignal, Show, createMemo, createEffect } from "solid-js"
import { generate } from "lean-qr"
import { toSvgSource } from "lean-qr/extras/svg"

export function PreviewPanel(props: {
  tunnelUrl?: string
}) {
  const url = () => props.tunnelUrl || "https://preview-f7a2.trykode.xyz"
  const [copied, setCopied] = createSignal(false)
  const [iframeSrc, setIframeSrc] = createSignal(url())

  // Keep iframe Src reactively in sync when url changes
  createEffect(() => {
    setIframeSrc(url())
  })

  // Dynamic QR Code generation
  const qrSvg = createMemo(() => {
    try {
      const code = generate(url())
      return toSvgSource(code, {
        on: "#000000",
        off: "transparent",
        pad: 1,
      })
    } catch (e) {
      // Fallback in case of error
      return `<svg viewBox="0 0 29 29" shape-rendering="crispEdges"><path fill="#ffffff" d="M0,0h29v29h-29z"/><path fill="#000000" d="M0,0h7v7h-7zM22,0h7v7h-7zM0,22h7v7h-7zM2,2h3v3h-3zM24,2h3v3h-3zM2,24h3v3h-3zM9,0h1v3h-1zM11,0h2v1h-2zM15,0h1v2h-1zM17,0h3v1h-3zM9,4h2v1h-2zM12,4h2v2h-2zM15,4h2v1h-2zM18,4h1v1h-1zM20,4h1v2h-1zM9,6h1v1h-1zM14,6h2v1h-2zM17,6h1v2h-1zM19,6h2v1h-2zM8,8h2v2h-2zM11,8h1v1h-1zM13,8h2v1h-2zM16,8h1v1h-1zM18,8h3v1h-3z"/></svg>`
    }
  })

  const copyLink = () => {
    navigator.clipboard.writeText(url())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div class="flex flex-col h-full bg-[#0d0d0d] text-[#e3e3e3] p-5 gap-6 overflow-y-auto no-scrollbar rounded-xl border border-white/5">
      {/* Header */}
      <div class="flex items-center justify-between border-b border-white/10 pb-4">
        <div class="flex items-center gap-2.5">
          <div class="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span class="text-sm font-semibold tracking-wider uppercase text-emerald-400">Live Preview Tunnel</span>
        </div>
        <span class="text-[10px] font-mono text-white/40">Secure Tunnel (SSL)</span>
      </div>

      {/* QR Code Container */}
      <div class="flex flex-col items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10 shadow-lg backdrop-blur-md">
        <div class="bg-white p-3 rounded-lg flex items-center justify-center shadow-inner size-40 overflow-hidden">
          {/* Beautiful Dynamic SVG QR Code */}
          <div class="size-full flex items-center justify-center [&>svg]:size-full [&>svg]:h-full [&>svg]:w-full" innerHTML={qrSvg()} />
        </div>
        <span class="text-[11.5px] text-[#a3a3a3] text-center max-w-[200px]">
          Scan with your phone's camera to test responsiveness instantly!
        </span>
      </div>

      {/* URL Link and Actions */}
      <div class="flex flex-col gap-2">
        <div class="text-[11px] font-semibold text-white/50 uppercase tracking-wider pl-1">Tunnel Endpoint</div>
        <div class="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10 select-all font-mono text-[12px] text-emerald-400 truncate">
          <span class="truncate flex-1">{url()}</span>
          <button
            onClick={copyLink}
            class="p-1.5 hover:bg-white/10 border-none rounded-md cursor-pointer text-emerald-400 hover:text-white transition-colors flex items-center justify-center shrink-0"
            title="Copy Link"
          >
            <Show when={copied()} fallback={
              <svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            }>
              <svg class="size-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </Show>
          </button>
        </div>
      </div>

      {/* Interactive Desktop Iframe Container */}
      <div class="flex-1 min-h-[220px] flex flex-col gap-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
          <span class="text-[11.5px] font-semibold text-white/60">TUI Iframe Preview</span>
          <button
            onClick={() => setIframeSrc(url() + "?t=" + Date.now())}
            class="p-1 hover:bg-white/10 border-none rounded cursor-pointer text-white/50 hover:text-white transition-colors flex items-center justify-center shrink-0"
            title="Refresh Preview"
          >
            <svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>
        <iframe
          src={iframeSrc()}
          class="flex-1 w-full border-none bg-white rounded-b-xl"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  )
}

