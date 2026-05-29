import { useState } from 'react'

const faqs = [
  { q: 'What makes Kode different from Cursor/Copilot?', a: 'Every other agent uses generate-and-pray — the LLM generates code and writes it directly to disk. Kode runs 9 deterministic verification gates between the LLM and your filesystem. If any gate fails, the patch is rejected and the LLM self-corrects. The user is never the verification layer.' },
  { q: 'What are the 9 verification gates?', a: 'Syntax (Tree-sitter AST parsing for 5 languages), Imports (dependency graph validation), Calls (hallucinated function detection), Blast Radius (downstream impact analysis), Architecture (module boundary enforcement), Security (vulnerability scanning), Sandbox Replay (dynamic runtime checks), QR Tunnel (mobile dev tunnel provisioning), and Browser E2E (Playwright UI verification). All run in a compiled Go binary in under 50ms.' },
  { q: 'How does the parser handle different environments?', a: 'Kode uses a dual-engine architecture. On systems with CGo enabled (like CI/CD or macOS/Linux), it compiles with the official Tree-sitter AST bindings for 100% precision. On strict local environments without a C compiler, it gracefully falls back to a fast, zero-dependency Regex implementation. Your build never breaks.' },
  { q: 'What is Kode?', a: 'Kode is an open source AI coding agent with a compiled Go verification engine. Every generated patch must pass 9 deterministic gates before touching your filesystem. It supports a full Plan → Critique → Generate → Verify → Apply → Test → Bench pipeline with automatic rollback.' },
  { q: 'How do I use Kode?', a: 'Install the binary, run kode init in your project, then kode loop "your task". The engine handles context gathering, LLM prompting, patch generation, verification, application, and testing in one cycle. Or use kode tui for the full interactive terminal experience.' },
  { q: 'Do I need extra AI subscriptions?', a: 'Kode is a Bring Your Own Key (BYOK) platform. You provide an API key for any OpenAI-compatible provider. We support 25+ providers natively: Claude, GPT, Gemini, Bedrock, Mistral, Groq, local models via Ollama/LMStudio, and more via the /connect command.' },
  { q: 'Can I use Kode as a verification layer for other AI agents?', a: 'Yes. Run kode mcp serve to expose Kode\'s verification engine as a tool any MCP-compatible agent can call. Claude Desktop, Cursor, Antigravity — any agent that supports MCP gets access to verified code generation via JSON-RPC 2.0.' },
  { q: 'Can I only use Kode in the terminal?', a: 'Kode works in the terminal via kode tui. But using kode mcp serve, you can integrate Kode directly into IDEs that support MCP. It also runs headlessly via kode run for CI/CD pipelines and scripting.' },
  { q: 'How much does Kode cost?', a: 'The core Kode engine is 100% free and open source. You pay only the direct API costs to your LLM provider. We\'re building premium features (Daemon Mode, Ghost Branches, advanced telemetry) for teams — pricing coming soon.' },
  { q: 'What about data and privacy?', a: 'Kode operates entirely on your local machine. We do not proxy, store, or view your code. Your repository context is sent directly from your localhost to your chosen LLM API provider. Blindfold Mode adds SHA-256 identifier obfuscation for additional protection.' },
  { q: 'Is Kode open source?', a: 'Yes. The full source is at github.com/sicario-labs/kode. The Go verification engine, TypeScript TUI, MCP server, and all 18 engine packages are entirely open.' },
]

export default function FAQ() {
  const [open, setOpen] = useState(null)

  return (
    <section id="faq">
      <div className="wrapper">
        <div className="features-list">
          <div className="heading-md" style={{ marginBottom: 24 }}>FAQ</div>
          {faqs.map((item, i) => (
            <div key={i} className={`faq-item ${open === i ? 'open' : ''}`}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="faq-question"
              >
                {item.q}
                <span>{open === i ? '\u2212' : '+'}</span>
              </button>
              <div className="faq-answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
