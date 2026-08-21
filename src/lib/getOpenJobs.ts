import { sheets } from "./googleClient"
import { getCompanySheetId } from "./getCompanySheetId"

const CONTROL_CENTER_ID = "1slOgchohy1pNoXKhGhx8FSMl5o6VjkAYkP4vWEby_ng"

export type Job = {
  position_name: string
  company: string
  detail: Record<string, string>
}

export async function getOpenJobs(search = ""): Promise<Job[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CONTROL_CENTER_ID,
    range: "Global_Open_Position!A2:D200",
  })

  const rows = res.data.values || []

  const openPositions = rows.filter((row: string[]) => {
    const positionName = row[2]?.toLowerCase() || ""
    const status = row[3]?.trim().toLowerCase() || ""
    return (
      status.includes("เปิด") &&
      (!search || positionName.includes(search.toLowerCase()))
    )
  })

  const result: Job[] = []

  for (const row of openPositions) {
    const company = row[1]
    const positionName = row[2]

    const companySheetId = await getCompanySheetId(company)
    if (!companySheetId) continue

    const detail = await sheets.spreadsheets.values.get({
      spreadsheetId: companySheetId,
      range: `${positionName}!A1:D200`,
    })

    const formatted: Record<string, string> = {}
    ;(detail.data.values || []).forEach((r: string[]) => {
      const key = r[1]
      const value = r[2]
      if (key && value && key !== "รายการ" && !key.includes("SECTION")) {
        formatted[key] = value
      }
    })

    result.push({ position_name: positionName, company, detail: formatted })
  }

  return result
}
