import { NextRequest, NextResponse } from "next/server"
import { getCompanySheetId } from "@/src/lib/getCompanySheetId"
import { sheets } from "@/src/lib/googleClient"

const CONTROL_CENTER_ID = "1slOgchohy1pNoXKhGhx8FSMl5o6VjkAYkP4vWEby_ng"

export async function GET(req: NextRequest) {
  const positionNameParam = req.nextUrl.searchParams.get("position_name")

  if (!positionNameParam) {
    return NextResponse.json({ success: false })
  }

  // กันปัญหา space เกิน / trim
  const positionName = positionNameParam.trim()

  // 1️⃣ หา row จากชื่อ (column C)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CONTROL_CENTER_ID,
    range: "Global_Open_Position!A2:D100",
  })

  const rows = res.data.values || []

  const found = rows.find((row: string[]) => {
    const sheetPositionName = row[2]?.trim()
    return sheetPositionName === positionName
  })

  if (!found) {
    return NextResponse.json({ success: false })
  }

  const company = found[1]

  // 2️⃣ หา spreadsheet_id บริษัท
  const companySheetId = await getCompanySheetId(company)

  if (!companySheetId) {
    return NextResponse.json({ success: false })
  }

  // 3️⃣ เปิดแท็บตำแหน่ง (ใช้ชื่อ sheet = position_name)
  const detail = await sheets.spreadsheets.values.get({
    spreadsheetId: companySheetId,
    range: `'${positionName}'!A1:D200`, // ใส่ '' ครอบกันชื่อมี space
  })

  const detailRows = detail.data.values || []

  const formatted: Record<string, string> = {}

  detailRows.forEach((row: string[]) => {
    const fieldName = row[1]
    const fieldValue = row[2]

    if (
      fieldName &&
      fieldValue &&
      fieldName !== "รายการ" &&
      !fieldName.includes("SECTION")
    ) {
      formatted[fieldName] = fieldValue
    }
  })

  return NextResponse.json({
    success: true,
    data: formatted,
  })
}