import { sheets_v4 } from "googleapis"
import { CONTROL_CENTER_ID } from "./constants"

export async function getCompanySheetMap(
  sheets: sheets_v4.Sheets
): Promise<Map<string, string>> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CONTROL_CENTER_ID,
    range: "Company_Config!A2:B100",
  })

  const map = new Map<string, string>()
  for (const row of res.data.values || []) {
    if (row[0] && row[1]) map.set(String(row[0]), String(row[1]))
  }
  return map
}
