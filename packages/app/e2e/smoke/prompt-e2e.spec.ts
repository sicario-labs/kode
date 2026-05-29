import { expect, test } from "@playwright/test"
import { base64Encode } from "@kode/core/util/encode"
import { fixture } from "./session-timeline.fixture"
import { trackPageErrors, expectNoSmokeErrors } from "../utils/errors"
import { mockKodeServer } from "../utils/mock-server"

test.describe("smoke: prompt E2E", () => {
  test.setTimeout(60_000)

  test("connects to provider, types a prompt, submits, and displays response", async ({ page }) => {
    const errors = trackPageErrors(page)

    // Setup custom message mock list so we can append dynamically
    const dynamicMessages = [...fixture.messages[fixture.targetID]]
    const mockMsgHandler = (sessionId: string, limit: number, before?: string) => {
      const messages = sessionId === fixture.targetID ? dynamicMessages : (fixture.messages[sessionId] ?? [])
      const end = before
        ? Math.max(0, messages.findIndex((message) => message.info.id === before))
        : messages.length
      const start = Math.max(0, end - limit)
      return {
        items: messages.slice(start, end),
        cursor: start > 0 ? messages[start]!.info.id : undefined,
      }
    }

    await mockKodeServer(page, {
      sessions: fixture.sessions,
      provider: fixture.provider,
      directory: fixture.directory,
      project: fixture.project,
      pageMessages: mockMsgHandler,
    })

    // Also route the prompt_async POST request
    await page.route("**/session/*/prompt_async", async (route) => {
      const userMsgId = "msg_user_dynamic_e2e"
      const assistantMsgId = "msg_assistant_dynamic_e2e"

      // Append user message
      dynamicMessages.push({
        info: {
          id: userMsgId,
          sessionID: fixture.targetID,
          role: "user",
          time: { created: Date.now() },
          agent: "build",
          model: fixture.provider.default,
        },
        parts: [
          {
            id: "prt_user_dynamic_text",
            sessionID: fixture.targetID,
            messageID: userMsgId,
            type: "text",
            text: "Hello from E2E prompt test",
          },
        ],
      })

      // Append assistant message
      dynamicMessages.push({
        info: {
          id: assistantMsgId,
          sessionID: fixture.targetID,
          role: "assistant",
          time: { created: Date.now() + 1000, completed: Date.now() + 2000 },
          parentID: userMsgId,
          modelID: fixture.provider.default.modelID,
          providerID: fixture.provider.default.providerID,
          mode: "build",
          agent: "build",
          path: { cwd: fixture.directory, root: fixture.directory },
          cost: 0.01,
          tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
          variant: "max",
          finish: "stop",
        },
        parts: [
          {
            id: "prt_assistant_dynamic_text",
            sessionID: fixture.targetID,
            messageID: assistantMsgId,
            type: "text",
            text: "E2E Prompt Response: I have successfully received and processed your instruction.",
          },
        ],
      })

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    })

    // Initialize local storage configurations
    await page.addInitScript(() => {
      localStorage.setItem(
        "settings.v3",
        JSON.stringify({
          general: {
            editToolPartsExpanded: true,
            shellToolPartsExpanded: true,
            showReasoningSummaries: true,
            showSessionProgressBar: true,
          },
        }),
      )
    })

    await page.addInitScript((directory) => {
      localStorage.setItem(
        "kode.global.dat:server",
        JSON.stringify({
          projects: {
            local: [{ worktree: directory, expanded: true }],
          },
          lastProject: {
            local: directory,
          },
        }),
      )
    }, fixture.directory)

    // Go to project home page
    await page.goto("/")

    // Select the smoke test project
    await page
      .locator('[data-component="home-project-row"]')
      .filter({ hasText: new RegExp(fixture.project.name, "i") })
      .click()
    await expect(page).toHaveURL(/\/$/)

    // Go to session detail
    await page.goto(`/${base64Encode(fixture.directory)}/session/${fixture.targetID}`)
    await expect(page.getByRole("heading", { name: fixture.expected.targetTitle })).toBeVisible()

    // Locate textbox, type prompt, and submit it
    const textbox = page.getByRole("textbox", { name: /Ask anything/i })
    await expect(textbox).toBeVisible()
    await textbox.fill("Hello from E2E prompt test")
    await textbox.press("Enter")

    // Expect the newly appended assistant message to appear in the DOM
    const assistantText = page.locator("text=E2E Prompt Response: I have successfully received and processed your instruction.")
    await expect(assistantText).toBeVisible({ timeout: 15000 })

    expectNoSmokeErrors(errors, [], [])
  })
})
