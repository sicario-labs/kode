import { useState } from 'react'

const faqs = [
  { q: 'What is Kode?', a: 'Kode is an open source AI coding agent with a compiled Go verification engine. Every generated patch must pass 5 deterministic gates (syntax, imports, calls, blast radius, architecture) before touching your filesystem.' },
  { q: 'How do I use Kode?', a: 'Install the binary, run kode init in your project, then kode loop "your task". The engine handles context gathering, LLM prompting, patch generation, verification, application, and testing in one cycle.' },
  { q: 'Do I need extra AI subscriptions?', a: 'Kode includes free models or you can connect any OpenAI-compatible provider. Claude, GPT, Gemini, local models — whatever you prefer.' },
  { q: 'Can I use my existing subscriptions?', a: 'Yes. Configure your API key and provider in .kode/kode.json. If you have a ChatGPT Plus, Pro, or GitHub Copilot subscription, you can use those as well.' },
  { q: 'Can I only use Kode in the terminal?', a: 'Kode works in your terminal, IDE, or as a desktop app. kode tui launches the full interactive TUI. IDE extensions are in development.' },
  { q: 'How much does Kode cost?', a: 'Kode itself is free and open source. You pay only for the LLM tokens you use. With Context Budgeting, you set hard cost caps per cycle — no surprise bills.' },
  { q: 'What about data and privacy?', a: 'Kode does not store your code or context. Blindfold Mode ensures identifiers are obfuscated before reaching any LLM provider. Everything runs locally on your machine.' },
  { q: 'Is Kode open source?', a: 'Yes. The full source is at github.com/sicario-labs/kode. Go engine, TypeScript TUI, CI/CD — everything is open.' },
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
