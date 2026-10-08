import { describe, expect, it } from "vitest"
import { APPLY_FORM_URL, buildFallbackReply, noDataFields } from "../fallbackReply"

describe("fallbackReply", () => {
  it("always points the user to the application form", () => {
    for (const reason of ["search_empty", "list_empty", "job_not_found", "field_missing"] as const) {
      expect(buildFallbackReply(reason)).toContain(APPLY_FORM_URL)
    }
  })

  it("mentions the query for an empty search", () => {
    expect(buildFallbackReply("search_empty", "ขับรถบรรทุก")).toContain("ขับรถบรรทุก")
  })

  it("noDataFields exposes the flag the bot keys on", () => {
    const f = noDataFields("job_not_found")
    expect(f.no_data).toBe(true)
    expect(f.fallback_reason).toBe("job_not_found")
    expect(f.reply_fallback).toContain(APPLY_FORM_URL)
  })
})
