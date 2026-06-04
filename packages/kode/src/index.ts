import { TuiThreadCommand } from "./cli/cmd/tui/thread"
import { BlindfoldCommand } from "./cli/cmd/blindfold"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@kode/core/installation/version"
import { EOL } from "os"

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("kode ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text)
    return
  }
  process.stderr.write(out)
}

const cli = (await import("yargs")).default(process.argv.slice(2))
  .scriptName("kode")
  .wrap(100)
  .command(TuiThreadCommand)
  .command(BlindfoldCommand)
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .help("help", "show help")
  .alias("help", "h")
  .completion("completion", "generate shell completion script")
  .fail((msg, err) => {
    if (err) throw err
    cli.showHelp(show)
    process.exit(1)
  })
  .strict()

try {
  const args = process.argv.slice(2)
  if (args.includes("-h") || args.includes("--help")) {
    await cli.parse(args, (_err: any, _argv: any, out: any) => {
      if (out) show(out)
    })
  } else {
    await (cli.parse() as Promise<unknown>).catch((e: unknown) => {
      process.stderr.write("CLI_PARSE_ERROR: " + (e instanceof Error ? e.stack : String(e)) + "\n")
      process.exitCode = 1
    })
  }
} catch (e: unknown) {
  process.stderr.write("TOP_LEVEL_CATCH: " + (e instanceof Error ? e.stack : String(e)) + "\n")
  process.exitCode = 1
} finally {
  process.exit()
}
