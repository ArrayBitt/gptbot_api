import { sheets_v4 } from "googleapis"

const SPREADSHEET_ID = "1slOgchohy1pNoXKhGhx8FSMl5o6VjkAYkP4vWEby_ng"
const RANGE = "A2:D100"

const normalize = (str: string) =>
  str.toLowerCase().normalize("NFKC").trim().replace(/\s+/g, "")

export async function searchPosition(sheets: sheets_v4.Sheets, name: string) {
  name = name.trim()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Global_Open_Position!${RANGE}`,
  })
  const rows = res.data.values || []
  const found = rows.find((row: string[]) =>
    normalize(row[2] ?? "").includes(normalize(name))
  )
  if (!found) return null
  return {
    position_id: found[0],
    company: found[1],
    position_name: found[2],
    is_active: found[3],
  }
}

export async function searchJobsByKeyword(sheets: sheets_v4.Sheets, keyword: string) {
  keyword = keyword.toLowerCase().trim()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Global_Open_Position!${RANGE}`,
  })
  const rows = res.data.values || []
  return rows
    .filter((row: string[]) => row[2]?.toLowerCase().includes(keyword))
    .map((row: string[]) => ({
      position_id: row[0],
      company: row[1],
      position_name: row[2],
      is_active: row[3],
    }))
}
