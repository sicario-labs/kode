import { Show, createSignal, onMount, onCleanup } from "solid-js"
import { useTheme } from "../context/theme"
import { useKV } from "../context/kv"
import type { JSX } from "@opentui/solid"
import type { RGBA } from "@opentui/core"
import "opentui-spinner/solid"

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export const THINKING_VERBS = [
  "Beboppin'",
  "Shenaniganing",
  "Discombobulating",
  "Lollygagging",
  "Moonwalking",
  "Pondering",
  "Zesting",
  "Flibbertigibbeting",
  "Combobulating",
  "Wrangling logits",
  "Warming up weights",
  "Consulting the oracle",
  "Algorithmic daydreaming",
  "Untangling recursion",
  "Staring into deep space",
  "Overthinking syntax",
  "Channeling computing pioneers",
  "Generating brilliant concepts",
  "Simulating alternative timelines",
  "Analyzing potential futures",
  "Consulting code spirits",
  "Meditating on parameters",
  "Formulating plan",
  "Cogitating trade-offs",
  "Sifting through context",
  "Designing workflows",
  "Mapping dependency graphs",
  "Parsing intent",
  "Interrogating weights",
  "Resolving ambiguities",
  "Puzzling over patterns",
  "Weighing possibilities",
  "Contemplating structures",
  "Architecting solutions",
  "Visualizing states",
  "Decoding prompts",
  "Conceptualizing steps",
  "Untangling scopes",
  "Navigating codebases",
  "Deliberating pathways",
  "Incubating heuristics",
  "Hypothesizing patches",
  "Extrapolating logic",
  "Exploring possibilities",
  "Synthesizing approaches",
  "Questioning requirements",
  "Translating concepts",
  "Filtering tokens",
  "Deducting logical paths",
  "Brainstorming approaches",
  "Aligning neural nets",
  "Daydreaming in binary"
]

export const EXECUTING_VERBS = [
  "Rewriting in Rust",
  "Blaming DNS",
  "Refactoring codebase",
  "Evaluating blast radius",
  "Consulting compiler",
  "Executing unit tests",
  "Compiling objects",
  "Slicing strings",
  "Wrangling pointers",
  "Deleting node_modules",
  "Hacking gatekeeper",
  "Committing to master",
  "Bending CSS",
  "Compressing logs",
  "Flushing socket buffers",
  "Garbage collecting heap",
  "Spawning subagents",
  "Injecting dependencies",
  "Bundling assets",
  "Deploying local replica",
  "Checking imports",
  "Aligning brackets",
  "Patching files",
  "Running grep searches",
  "Fetching URL content",
  "Testing assertions",
  "Running lint checks",
  "Optimizing imports",
  "Generating diffs",
  "Mutating code state",
  "Calling APIs",
  "Resolving dependencies",
  "Building graph caches",
  "Executing background tasks",
  "Validating gatekeeper checks",
  "Writing disk sectors",
  "Overwriting configs",
  "Spawning subprocesses",
  "Querying local db",
  "Profiling CPU usage",
  "Pruning unused assets",
  "Escaping sandbox limits",
  "Rewriting history",
  "Pushing build outputs",
  "Transpiling modules",
  "Purging memory pools",
  "Triggering hooks",
  "Running AST traversals",
  "Simulating side effects",
  "Rebuilding code modules",
  "Inspecting file trees",
  "Polishing UI details"
]

export const PLANNING_VERBS = [
  "Mapping the terrain",
  "Sketching the attack surface",
  "Drafting the route",
  "Surveying scope",
  "Plotting checkpoints",
  "Charting dependencies",
  "Indexing blast radius",
  "Triangulating intent",
  "Drafting hypotheses",
  "Reading the room",
  "Anchoring objectives",
  "Sketching the data flow",
  "Enumerating edge cases",
  "Sketching contracts",
  "Outlining tests first",
  "Choosing the trade",
  "Framing the problem",
  "Casting the plan",
  "Locking the spec",
  "Scoping the patch",
]

export const CRITIQUING_VERBS = [
  "Stress-testing the plan",
  "Probing for weak spots",
  "Poking the contract",
  "Holding up the mirror",
  "Walking the worst case",
  "Picking at the seams",
  "Hunting smells",
  "Re-reading the diff",
  "Hammering the spec",
  "Panning for bugs",
  "Measuring twice",
  "Sharpening the test",
  "Catching the regression",
  "Re-deriving invariants",
  "Calling out the lie",
  "Questioning the premise",
  "Smelling the smoke",
  "Checking the blast",
  "Asking the hard question",
  "Reviewing the angles",
]

export const GENERATING_VERBS = [
  "Laying down bytes",
  "Casting the patch",
  "Inking the diff",
  "Composing the change",
  "Weaving the import",
  "Shaping the function",
  "Fleshing out the type",
  "Drawing the boundary",
  "Stitching the call sites",
  "Pouring the test",
  "Drafting the comment",
  "Tuning the signature",
  "Painting the example",
  "Minting the symbol",
  "Casting the helper",
  "Forging the module",
  "Tying off the loose end",
  "Sketching the demo",
  "Inking the doc",
  "Threading the needle",
]

export const VERIFYING_VERBS = [
  "Running the gate suite",
  "Reading the diff twice",
  "Checking syntax",
  "Hunting the import",
  "Probing the call graph",
  "Probing the architecture",
  "Measuring blast radius",
  "Probing the sandbox",
  "Walking the test ladder",
  "Sanity-checking the patch",
  "Tracing the type",
  "Walking the 7 gates",
  "Quoting the rules",
  "Calling the gatekeeper",
  "Reading the verdict",
  "Holding the patch to the light",
  "Validating against the spec",
  "Surveying the diff tree",
  "Reading the safety report",
  "Crossing the t's",
]

export function Spinner(props: { children?: JSX.Element; color?: RGBA; context?: "thinking" | "executing" | "planning" | "critiquing" | "generating" | "verifying" }) {
  const { theme } = useTheme()
  const kv = useKV()
  const color = () => props.color ?? theme.textMuted

  const list = () => {
    if (props.context === "thinking") return THINKING_VERBS
    if (props.context === "executing") return EXECUTING_VERBS
    if (props.context === "planning") return PLANNING_VERBS
    if (props.context === "critiquing") return CRITIQUING_VERBS
    if (props.context === "generating") return GENERATING_VERBS
    if (props.context === "verifying") return VERIFYING_VERBS
    return []
  }

  const [index, setIndex] = createSignal(0)

  onMount(() => {
    if (props.context) {
      const verbs = list()
      if (verbs.length > 0) {
        setIndex(Math.floor(Math.random() * verbs.length))
      }
      const interval = setInterval(() => {
        const currentList = list()
        if (currentList.length > 0) {
          setIndex((prev) => (prev + 1) % currentList.length)
        }
      }, 1200)
      onCleanup(() => clearInterval(interval))
    }
  })

  const displayText = () => {
    const verbs = list()
    if (verbs.length > 0) {
      return verbs[index()]
    }
    return props.children
  }

  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={color()}>⋯ {displayText()}</text>}>
      <box flexDirection="row" gap={1}>
        <spinner frames={SPINNER_FRAMES} interval={80} color={color()} />
        <Show when={displayText()}>
          <text fg={color()}>{displayText()}</text>
        </Show>
      </box>
    </Show>
  )
}

