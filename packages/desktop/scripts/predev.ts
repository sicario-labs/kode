import { $ } from "bun"

await $`bun ./scripts/copy-icons.ts ${process.env.KODE_CHANNEL ?? "dev"}`

await $`cd ../kode && bun script/build-node.ts`
