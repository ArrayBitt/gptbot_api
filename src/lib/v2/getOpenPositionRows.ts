import { sheets_v4 } from "googleapis"
import { CONTROL_CENTER_ID } from "./constants"

export type OpenPositionRow = {
  position_id: string
  company: string
  position_name: string
  is_active: string
}

/**
 * Sheet tabs the sync script (importPositionsDirect, Apps Script) picks up
 * automatically that aren't real driver positions — e.g. a recruitment
 * event promo tab. These must still respect the sheet's own เปิด/ปิด
 * status (never invent availability), so they're NOT excluded here at the
 * source — only from plain browsing (`jobs_list`, generic `jobs_search`
 * keyword buckets). A caller that searches for one by its exact name
 * (`isPromoOnlyPosition`) still finds it when open, and finds nothing
 * when closed, because `getOpenPositionRows` already filters by is_active
 * below — that's what lets the "โฆษณา" prompt flow check real status via
 * a normal jobs_search call instead of a status-blind hardcoded reply.
 */
const PROMO_ONLY_POSITION_NAMES = ["Driver Day"]

export function isPromoOnlyPosition(name: string): boolean {
  const n = name.normalize("NFKC").trim().toLowerCase()
  return PROMO_ONLY_POSITION_NAMES.some(
    (x) => x.normalize("NFKC").trim().toLowerCase() === n
  )
}

export async function getOpenPositionRows(
  sheets: sheets_v4.Sheets
): Promise<OpenPositionRow[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CONTROL_CENTER_ID,
    range: "Global_Open_Position!A2:D200",
  })

  return (res.data.values || [])
    .filter((row) => String(row[3] || "").trim().toLowerCase().includes("เปิด"))
    .map((row) => ({
      position_id: String(row[0] || "").trim(),
      company: String(row[1] || "").trim(),
      position_name: String(row[2] || "").trim(),
      is_active: String(row[3] || "").trim(),
    }))
    .filter((row) => row.company && row.position_name)
}
