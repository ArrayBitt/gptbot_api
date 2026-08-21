import { sheets_v4 } from "googleapis"
import { getOpenPositionRows } from "./getOpenPositionRows"
import { getCompanySheetMap } from "./getCompanySheetMap"
import { resolveSheetTitle } from "./getJobDetail"

export type JobListItem = {
  position_name: string
  company: string
  position_group?: string
  location?: string
}

async function getPositionMeta(
  sheets: sheets_v4.Sheets,
  companySheetId: string,
  positionName: string
): Promise<{ position_group: string; location: string }> {
  try {
    const sheetTitle = await resolveSheetTitle(
      sheets,
      companySheetId,
      positionName
    )
    if (!sheetTitle) {
      return { position_group: "", location: "" }
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: companySheetId,
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1:D40`,
    })
    const rows = res.data.values || []
    const group =
      rows.find((r) => String(r[1] || "").trim() === "กลุ่มตำแหน่งงาน")?.[2] || ""
    const location =
      rows.find((r) => String(r[1] || "").trim() === "สถานที่ทำงาน")?.[2] || ""
    return {
      position_group: String(group || "").trim(),
      location: String(location || "").trim(),
    }
  } catch {
    return { position_group: "", location: "" }
  }
}

/** Place-like parenthetical only; skip tags like (Client). */
function fallbackLocationFromName(positionName: string) {
  const m = positionName.match(/\(([^)]+)\)/)
  const raw = m?.[1]?.trim() || ""
  if (!raw) return ""
  if (/^(client|spare|สแปร์)$/i.test(raw)) return ""
  return raw
}

/**
 * Lightweight list for GPT.
 * Always include EVERY open position from Global_Open_Position.
 * Missing detail tab → still list the job; location/group may be empty.
 */
export async function getJobListLight(
  sheets: sheets_v4.Sheets,
  options: { withMeta?: boolean } = {}
): Promise<JobListItem[]> {
  const withMeta = options.withMeta !== false
  const openPositions = await getOpenPositionRows(sheets)

  if (!withMeta) {
    return openPositions.map(({ position_name, company }) => ({
      position_name,
      company,
    }))
  }

  const companyMap = await getCompanySheetMap(sheets)

  return Promise.all(
    openPositions.map(async ({ position_name, company }) => {
      const companySheetId = companyMap.get(company)
      if (!companySheetId) {
        return {
          position_name,
          company,
          location: fallbackLocationFromName(position_name) || undefined,
        } satisfies JobListItem
      }

      const meta = await getPositionMeta(sheets, companySheetId, position_name)
      return {
        position_name,
        company,
        position_group: meta.position_group || undefined,
        location:
          meta.location ||
          fallbackLocationFromName(position_name) ||
          undefined,
      } satisfies JobListItem
    })
  )
}

export function uniqueZones(items: JobListItem[]): string[] {
  return summarizeZones(items).map((z) => z.zone)
}

export type ZoneSummary = {
  zone: string
  count: number
}

/** Clean zone label for user-facing answers. */
export function cleanZoneLabel(raw: string) {
  return raw
    .replace(/\s*\(ไม่ระบุชื่อบริษัทลูกค้า\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function summarizeZones(items: JobListItem[]): ZoneSummary[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const raw = (item.location || "").trim() || "ไม่ระบุโซน"
    const zone = cleanZoneLabel(raw) || "ไม่ระบุโซน"
    map.set(zone, (map.get(zone) || 0) + 1)
  }
  return [...map.entries()]
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count || a.zone.localeCompare(b.zone, "th"))
}
