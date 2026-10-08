import { describe, expect, it } from "vitest"
import type { sheets_v4 } from "googleapis"
import { expandSearchQuery, searchJobs } from "../searchJobs"

/** Fake Sheets client: only Global_Open_Position is read for non-nationality queries. */
function fakeSheets(rows: string[][]): sheets_v4.Sheets {
  return {
    spreadsheets: {
      values: { get: async () => ({ data: { values: rows } }) },
    },
  } as unknown as sheets_v4.Sheets
}

// [position_id, company, position_name, status]
const ROWS = [
  ["1", "Driver", "พนักงานขับรถส่วนกลาง คลองเตย", "เปิด"],
  ["2", "Driver", "พนักงานขับรถส่วนกลาง วิภาวดี", "เปิด"],
  ["3", "Driver", "พนักงานขับรถผู้บริหาร จรัญ 41", "เปิด"],
  ["4", "Driver", "พนักงานขับรถส่วนกลาง ดุสิต", "ปิด"],
]

describe("expandSearchQuery", () => {
  it("returns [] for empty input", () => {
    expect(expandSearchQuery("   ")).toEqual([])
  })

  it("maps 'ขับรถนาย' to the executive bucket", () => {
    expect(expandSearchQuery("ขับรถนาย")).toContain("ผู้บริหาร")
  })

  it("maps 'นาย' + nationality to the executive bucket in any order", () => {
    expect(expandSearchQuery("นายคนไทย")).toContain("ผู้บริหาร")
  })

  it("maps casual shuttle phrases to 'ส่วนกลาง'", () => {
    expect(expandSearchQuery("ขับรถรับส่ง")).toContain("ส่วนกลาง")
  })
})

describe("searchJobs", () => {
  it("finds open positions that match the keyword", async () => {
    const res = await searchJobs(fakeSheets(ROWS), "ส่วนกลาง")
    expect(res.map((r) => r.position_name).sort()).toEqual([
      "พนักงานขับรถส่วนกลาง คลองเตย",
      "พนักงานขับรถส่วนกลาง วิภาวดี",
    ])
  })

  it("never returns closed positions", async () => {
    const res = await searchJobs(fakeSheets(ROWS), "ดุสิต")
    expect(res).toEqual([])
  })

  it("returns [] when nothing matches (route turns this into no_data)", async () => {
    expect(await searchJobs(fakeSheets(ROWS), "ขับรถบรรทุก")).toEqual([])
  })

  it("expands casual phrases before matching", async () => {
    const res = await searchJobs(fakeSheets(ROWS), "ขับรถนาย")
    expect(res.map((r) => r.position_name)).toEqual(["พนักงานขับรถผู้บริหาร จรัญ 41"])
  })
})
