import { sheets } from "./googleClient"

const CONTROL_CENTER_ID = "1slOgchohy1pNoXKhGhx8FSMl5o6VjkAYkP4vWEby_ng"

export async function getCompanySheetId(company: string): Promise<string | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CONTROL_CENTER_ID,
    range: "Company_Config!A2:B100",
  })
  const rows = res.data.values || []
  const found = rows.find((row: string[]) => row[0] === company)
  return found ? found[1] : null
}
