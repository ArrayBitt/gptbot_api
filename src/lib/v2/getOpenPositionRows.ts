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
 * event promo tab. Keep them "เปิด" in the sheet (don't touch that data),
 * just never surface them via jobs_list/jobs_search/jobs_detail. The bot
 * offers these separately via a hardcoded reply on a specific keyword
 * (see the system prompt), not through the normal job-listing flow.
 */
const EXCLUDED_POSITION_NAMES = ["Driver Day"]

function isExcludedPosition(name: string): boolean {
  const n = name.normalize("NFKC").trim().toLowerCase()
  return EXCLUDED_POSITION_NAMES.some(
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
    .filter((row) => !isExcludedPosition(row.position_name))
}
