import { ProviderAuth } from "@/provider/auth"
import { Config } from "@/config/config"
import { ModelsDev } from "@kode/core/models-dev"
import { Provider } from "@/provider/provider"
import { ProviderID } from "@/provider/schema"
import { mapValues } from "remeda"
import { Effect, Schema } from "effect"

const OPENMODEL_DEFS = [
  { id: "claude-haiku-4-5-20251001", name: "Claude 4.5 Haiku (20251001)", family: "claude", context: 200000, maxOutput: 64000, inputCost: 1, outputCost: 5 },
  { id: "claude-opus-4-6", name: "Claude 4.6 Opus", family: "claude", context: 1000000, maxOutput: 128000, inputCost: 5, outputCost: 25 },
  { id: "claude-opus-4-7", name: "Claude 4.7 Opus", family: "claude", context: 1000000, maxOutput: 128000, inputCost: 5, outputCost: 25 },
  { id: "claude-opus-4-8", name: "Claude 4.8 Opus", family: "claude", context: 1000000, maxOutput: 128000, inputCost: 5, outputCost: 25 },
  { id: "claude-sonnet-4-6", name: "Claude 4.6 Sonnet", family: "claude", context: 1000000, maxOutput: 64000, inputCost: 3, outputCost: 15 },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", family: "deepseek-v4", context: 1000000, maxOutput: 8192, inputCost: 0.035, outputCost: 0.07 },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", family: "deepseek-v4", context: 1000000, maxOutput: 8192, inputCost: 0.435, outputCost: 0.87, reasoning: true },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview", family: "gemini", context: 1000000, maxOutput: 65536, inputCost: 0.5, outputCost: 3 },
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite Preview", family: "gemini", context: 1000000, maxOutput: 65536, inputCost: 0.25, outputCost: 1.5 },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", family: "gemini", context: 1000000, maxOutput: 65536, inputCost: 2, outputCost: 12 },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", family: "gemini", context: 1000000, maxOutput: 65536, inputCost: 1.5, outputCost: 9 },
  { id: "gpt-5.3-codex", name: "GPT 5.3 Codex", family: "gpt-5", context: 272000, maxOutput: 128000, inputCost: 1.75, outputCost: 14 },
  { id: "gpt-5.4", name: "GPT 5.4", family: "gpt-5", context: 1100000, maxOutput: 128000, inputCost: 2.5, outputCost: 15 },
  { id: "gpt-5.4-mini", name: "GPT 5.4 Mini", family: "gpt-5", context: 272000, maxOutput: 128000, inputCost: 0.75, outputCost: 4.5 },
  { id: "gpt-5.4-pro", name: "GPT 5.4 Pro", family: "gpt-5", context: 1100000, maxOutput: 128000, inputCost: 30, outputCost: 180 },
  { id: "gpt-5.5", name: "GPT 5.5", family: "gpt-5", context: 1100000, maxOutput: 128000, inputCost: 5, outputCost: 30 },
  { id: "mimo-v2-flash", name: "Mimo V2 Flash", family: "mimo", context: 262144, maxOutput: 16384, inputCost: 0.1, outputCost: 0.3 },
  { id: "mimo-v2-omni", name: "Mimo V2 Omni", family: "mimo", context: 262144, maxOutput: 16384, inputCost: 0.4, outputCost: 2 },
  { id: "mimo-v2-pro", name: "Mimo V2 Pro", family: "mimo", context: 1000000, maxOutput: 16384, inputCost: 1, outputCost: 3 },
  { id: "mimo-v2.5", name: "Mimo V2.5", family: "mimo", context: 131072, maxOutput: 16384, inputCost: 0.14, outputCost: 0.28 }
]

const OPENMODEL_PROVIDER: ModelsDev.Provider = {
  id: "openmodel",
  name: "OpenModel",
  env: ["OPENMODEL_API_KEY"],
  npm: "@ai-sdk/anthropic",
  api: "https://api.openmodel.ai/v1",
  models: Object.fromEntries(
    OPENMODEL_DEFS.map((d) => [
      d.id,
      {
        id: d.id,
        name: d.name,
        family: d.family,
        release_date: "",
        attachment: true,
        reasoning: (d as any).reasoning ?? false,
        temperature: true,
        tool_call: true,
        limit: { context: d.context, output: d.maxOutput },
        cost: { input: d.inputCost, output: d.outputCost },
        modalities: { input: ["text"], output: ["text"] },
        provider: { npm: "@ai-sdk/anthropic", api: "https://api.openmodel.ai/v1" },
      },
    ])
  ),
}


import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ProviderAuthApiError } from "../groups/provider"

function mapProviderAuthError<A, R>(self: Effect.Effect<A, ProviderAuth.Error, R>) {
  return self.pipe(
    Effect.mapError((error) => {
      if (error instanceof ProviderAuth.OauthMissing) {
        return new ProviderAuthApiError({ name: error._tag, data: { providerID: error.providerID } })
      }
      if (error instanceof ProviderAuth.OauthCodeMissing) {
        return new ProviderAuthApiError({ name: error._tag, data: { providerID: error.providerID } })
      }
      if (error instanceof ProviderAuth.OauthCallbackFailed) {
        return new ProviderAuthApiError({ name: error._tag, data: {} })
      }
      if (error instanceof ProviderAuth.ValidationFailed) {
        return new ProviderAuthApiError({ name: error._tag, data: { field: error.field, message: error.message } })
      }
      return new ProviderAuthApiError({ name: "BadRequest", data: {} })
    }),
  )
}

export const providerHandlers = HttpApiBuilder.group(InstanceHttpApi, "provider", (handlers) =>
  Effect.gen(function* () {
    const cfg = yield* Config.Service
    const provider = yield* Provider.Service
    const svc = yield* ProviderAuth.Service

    const list = Effect.fn("ProviderHttpApi.list")(function* () {
      const config = yield* cfg.get()
      const all = yield* ModelsDev.Service.use((s) => s.get())
      const disabled = new Set(config.disabled_providers ?? [])
      const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined
      const filtered: Record<string, (typeof all)[string]> = {}
      for (const [key, value] of Object.entries(all)) {
        if ((enabled ? enabled.has(key) : true) && !disabled.has(key)) filtered[key] = value
      }
      if (!filtered["openmodel"] && !disabled.has("openmodel") && (!enabled || enabled.has("openmodel"))) {
        filtered["openmodel"] = OPENMODEL_PROVIDER
      }
      const connected = yield* provider.list()
      const providers = Object.assign(
        mapValues(filtered, (item) => Provider.fromModelsDevProvider(item)),
        connected,
      )
      return {
        all: Object.values(providers).map(Provider.toPublicInfo),
        default: Provider.defaultModelIDs(providers),
        connected: Object.keys(connected),
      }
    })

    const auth = Effect.fn("ProviderHttpApi.auth")(function* () {
      return yield* svc.methods()
    })

    const authorize = Effect.fn("ProviderHttpApi.authorize")(function* (ctx: {
      params: { providerID: ProviderID }
      payload: ProviderAuth.AuthorizeInput
    }) {
      return yield* mapProviderAuthError(
        svc.authorize({
          providerID: ctx.params.providerID,
          method: ctx.payload.method,
          inputs: ctx.payload.inputs,
        }),
      )
    })

    const authorizeRaw = Effect.fn("ProviderHttpApi.authorizeRaw")(function* (ctx: {
      params: { providerID: ProviderID }
      request: HttpServerRequest.HttpServerRequest
    }) {
      const body = yield* Effect.orDie(ctx.request.text)
      const payload = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ProviderAuth.AuthorizeInput))(body).pipe(
        Effect.mapError(() => new ProviderAuthApiError({ name: "BadRequest", data: {} })),
      )
      // Match legacy route behavior: when authorize() resolves without a
      // result (e.g. no further redirect), serialize as JSON `null` instead
      // of an empty body so clients can `.json()` parse the response.
      const result = yield* authorize({ params: ctx.params, payload })
      return HttpServerResponse.jsonUnsafe(result ?? null)
    })

    const callback = Effect.fn("ProviderHttpApi.callback")(function* (ctx: {
      params: { providerID: ProviderID }
      payload: ProviderAuth.CallbackInput
    }) {
      yield* mapProviderAuthError(
        svc.callback({
          providerID: ctx.params.providerID,
          method: ctx.payload.method,
          code: ctx.payload.code,
        }),
      )
      return true
    })

    return handlers
      .handle("list", list)
      .handle("auth", auth)
      .handleRaw("authorize", authorizeRaw)
      .handle("callback", callback)
  }),
)
