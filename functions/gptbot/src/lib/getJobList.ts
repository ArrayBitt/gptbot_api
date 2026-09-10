import { sheets_v4 } from "googleapis"

const CONTROL_CENTER_ID = "1slOgchohy1pNoXKhGhx8FSMl5o6VjkAYkP4vWEby_ng"

export type JobListItem = {
  position_name: string
  company: string
  กลุ่มตำแหน่งงาน: string
}

async function getCompanySheetMap(sheets: sheets_v4.Sheets): Promise<Map<string, string>> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CONTROL_CENTER_ID,
    range: "Company_Config!A2:B100",
  })
  const map = new Map<string, string>()
  for (const row of res.data.values || []) {
    if (row[0] && row[1]) map.set(row[0], row[1])
  }
  return map
}

async function getPositionGroup(
  sheets: sheets_v4.Sheets,
  companySheetId: string,
  positionName: string
): Promise<string> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: companySheetId,
    range: `'${positionName}'!A1:D10`,
  })
  const found = (res.data.values || []).find((r: string[]) => r[1] === "กลุ่มตำแหน่งงาน")
  return found?.[2] || ""
}

export async function getJobList(sheets: sheets_v4.Sheets): Promise<JobListItem[]> {
  const [posRes, companyMap] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: CONTROL_CENTER_ID,
      range: "Global_Open_Position!A2:D200",
    }),
    getCompanySheetMap(sheets),
  ])

  const openPositions = (posRes.data.values || []).filter(
    (row: string[]) => row[3]?.trim().toLowerCase().includes("เปิด")
  )

  const results = await Promise.all(
    openPositions.map(async (row: string[]) => {
      const company: string = row[1]
      const positionName: string = row[2]
      const companySheetId = companyMap.get(company)
      if (!companySheetId) return null

      const group = await getPositionGroup(sheets, companySheetId, positionName)
      return { position_name: positionName, company, กลุ่มตำแหน่งงาน: group }
    })
  )

  return results.filter((r): r is JobListItem => r !== null)
}
