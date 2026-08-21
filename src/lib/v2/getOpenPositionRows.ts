import { sheets_v4 } from "googleapis"
import { CONTROL_CENTER_ID } from "./constants"

export type OpenPositionRow = {
  position_id: string
  company: string
  position_name: string
  is_active: string
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
