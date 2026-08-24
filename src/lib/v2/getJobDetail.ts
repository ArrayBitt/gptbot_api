import { sheets_v4 } from "googleapis"
import { getCompanySheetMap } from "./getCompanySheetMap"
import { getJobListLight, type JobListItem } from "./getJobListLight"
import { getOpenPositionRows } from "./getOpenPositionRows"
import { parseDetailRows } from "./parseDetailRows"

export type JobDetail = {
  position_name: string
  company: string
  detail: Record<string, string>
}

function normalizeName(s: string) {
  return s.normalize("NFKC").trim().replace(/\s+/g, " ")
}

/**
 * Drop trailing location pasted from list lines, e.g. "งาน A — โซน B".
 * Only split on em/en dash. NEVER split on hyphen "-"
 * (place names like สุขุมวิท-อโศก / กทม.-ปริมณฑล must stay intact).
 */
function stripListLocationSuffix(s: string) {
  return s.split(/\s*[—–]\s*/)[0]?.trim() || s
}

/**
 * Canonical compare key:
 * - drop parenthetical tags like (Client)
 * - drop leading พนักงาน
 */
export function coreName(s: string) {
  return normalizeName(
    s
      .replace(/\([^)]*\)/g, " ")
      .replace(/^พนักงาน\s*/u, "")
      .replace(/\s+/g, " ")
  )
}

/**
 * Strip chat / question words so dirty user text still resolves.
 * e.g. "ขับรถงานลูกค้าคืออะไร" → "ขับรถงานลูกค้า"
 */
export function cleanPositionQuery(raw: string) {
  let s = normalizeName(raw)
  s = stripListLocationSuffix(s)

  const junk = [
    "ต้องการดูรายละเอียดเพิ่มเติม",
    "ขอดูรายละเอียดเพิ่มเติม",
    "ดูรายละเอียดเพิ่มเติม",
    "รายละเอียดเพิ่มเติม",
    "สนใจอันนี้",
    "สนใจตำแหน่งนี้",
    "สนใจงานนี้",
    "เอาอันนี้",
    "ขออันนี้",
    "ดูอันนี้",
    "ต้องการดู",
    "ต้องการ",
    "ขอดู",
    "ดู",
    "ขอรายละเอียด",
    "เพิ่มเติม",
    "รายละเอียด",
    "อยากสมัคร",
    "ขอสมัคร",
    "สมัครอันนี้",
    "สมัคร",
    "สนใจ",
    "คืออะไรคะ",
    "คืออะไรครับ",
    "คืออะไรค่ะ",
    "คืออะไร",
    "คือไร",
    "งานยังไง",
    "ยังไง",
    "อะไรคะ",
    "อะไรครับ",
    "อะไรค่ะ",
    "อะไร",
    "หน่อย",
    "ครับ",
    "ค่ะ",
    "คะ",
    "คับ",
  ]

  junk.sort((a, b) => b.length - a.length)

  for (const word of junk) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    s = s.replace(new RegExp(`${escaped}\\s*$`, "i"), "").trim()
    s = s.replace(new RegExp(`\\s*${escaped}\\s*`, "i"), " ").trim()
  }

  // Trailing chat particles only when separated by whitespace.
  // Do NOT strip bare "นะ" (breaks names like แจ้งวัฒนะ).
  s = s.replace(/\s+(ไง|น่ะ|นะ)\s*$/i, "").trim()
  s = s.replace(/(งานนี้|อันนี้)ไง\s*$/i, "$1").trim()

  return normalizeName(s)
}

/**
 * Strict title match.
 * Prevents "ขับรถผู้บริหาร" → "พนักงานขับรถผู้บริหารชาวฝรั่งเศส".
 */
export function scoreTitleMatch(wanted: string, title: string) {
  const w = normalizeName(wanted)
  const t = normalizeName(title)
  if (!w || !t) return 0
  if (w === t) return 100

  const wc = coreName(w)
  const tc = coreName(t)
  if (wc && tc && wc === tc) return 95

  // Containment only when leftover text is tiny (spaces / punctuation only).
  // Reject "ขับรถผู้บริหาร" matching "...ชาวฝรั่งเศส" or "...ไทรม้า".
  const containsScore = (shorter: string, longer: string, base: number) => {
    if (shorter.length < 6) return 0
    if (!longer.includes(shorter)) return 0
    const leftover = normalizeName(longer.replace(shorter, " "))
      .replace(/^พนักงาน\s*/u, "")
      .trim()
    if (leftover.length >= 3) return 0
    return base + Math.min(shorter.length, 19)
  }

  return Math.max(
    containsScore(t, w, 80),
    containsScore(w, t, 70),
    containsScore(tc, wc, 65),
    containsScore(wc, tc, 60)
  )
}

/** True when titles refer to the same job sheet (exact / core). */
export function isStrongTitleMatch(wanted: string, title: string) {
  return scoreTitleMatch(wanted, title) >= 95
}

/**
 * Same as normalizeName, but also drops the space between Thai text and a
 * trailing digit (e.g. "พระราม 9" -> "พระราม9"), so location names typed
 * without a space still match the sheet's spaced value, and vice versa.
 * Only used as a comparison key here — never for display.
 */
function normalizeLocationKey(s: string) {
  return normalizeName(s).replace(/\s+(?=\d)/g, "")
}

function scoreLocationMatch(wanted: string, item: JobListItem): number {
  const w = normalizeName(wanted)
  const loc = normalizeName(item.location || "")
  const name = normalizeName(item.position_name)
  if (!w) return 0

  if (loc && loc === w) return 98
  if (loc && loc.length >= 4 && w.includes(loc)) return 92
  if (loc && loc.length >= 4 && loc.includes(w)) return 90
  if (name.endsWith(w) && w.length >= 4) return 88

  // Fallback: retry with the space-before-digit boundary normalized away.
  const wKey = normalizeLocationKey(wanted)
  const locKey = normalizeLocationKey(item.location || "")
  const nameKey = normalizeLocationKey(item.position_name)
  if (wKey) {
    if (locKey && locKey === wKey) return 96
    if (locKey && locKey.length >= 4 && wKey.includes(locKey)) return 90
    if (locKey && locKey.length >= 4 && locKey.includes(wKey)) return 88
    if (nameKey.endsWith(wKey) && wKey.length >= 4) return 86
  }
  return 0
}

/** Zone/location fallback when title match is weak or wrong. */
async function resolveByLocation(
  sheets: sheets_v4.Sheets,
  wanted: string,
  companyHint?: string
): Promise<{ position_name: string; company: string } | null> {
  const list = await getJobListLight(sheets, { withMeta: true })
  const hint = companyHint?.trim()

  const candidates = list
    .filter((item) => !hint || item.company === hint)
    .map((item) => ({
      item,
      score: Math.max(
        scoreTitleMatch(wanted, item.position_name),
        scoreLocationMatch(wanted, item)
      ),
    }))
    .filter((x) => x.score >= 85)
    .sort((a, b) => b.score - a.score)

  if (candidates.length === 0) return null
  if (candidates.length === 1) {
    return {
      position_name: candidates[0].item.position_name,
      company: candidates[0].item.company,
    }
  }
  if (candidates[0].score > candidates[1].score + 3) {
    return {
      position_name: candidates[0].item.position_name,
      company: candidates[0].item.company,
    }
  }
  return null
}

/** Map dirty user text → exact open-position row when possible. */
async function resolveOpenPosition(
  sheets: sheets_v4.Sheets,
  positionName: string,
  companyHint?: string
): Promise<{ position_name: string; company: string } | null> {
  const open = await getOpenPositionRows(sheets)
  const wanted = cleanPositionQuery(positionName)
  if (!wanted) return null

  const scored = open
    .map((r) => ({ r, score: scoreTitleMatch(wanted, r.position_name) }))
    .filter((x) => x.score >= 95)
    .sort((a, b) => b.score - a.score)

  const hint = companyHint?.trim()
  if (hint) {
    const withCompany = scored.find((x) => x.r.company === hint)
    if (withCompany) {
      return {
        position_name: withCompany.r.position_name,
        company: withCompany.r.company,
      }
    }
  }

  if (scored.length > 0) {
    return {
      position_name: scored[0].r.position_name,
      company: scored[0].r.company,
    }
  }

  return resolveByLocation(sheets, wanted, companyHint)
}

export async function resolveSheetTitle(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  positionName: string
): Promise<string | null> {
  const wanted = cleanPositionQuery(positionName)
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  })

  const titles = (meta.data.sheets || [])
    .map((s) => s.properties?.title || "")
    .filter(Boolean)

  let best: { title: string; score: number } | null = null
  for (const title of titles) {
    const score = scoreTitleMatch(wanted, title)
    if (score > 0 && (!best || score > best.score)) {
      best = { title, score }
    }
  }

  // Only accept strong matches for sheet resolution to avoid wrong-job details.
  if (!best || best.score < 95) return null
  return best.title
}

export async function getJobDetail(
  sheets: sheets_v4.Sheets,
  positionName: string,
  company = ""
): Promise<JobDetail | null> {
  const resolved = await resolveOpenPosition(sheets, positionName, company)
  if (!resolved) return null

  const companyMap = await getCompanySheetMap(sheets)
  const companySheetId = companyMap.get(resolved.company)
  if (!companySheetId) return null

  try {
    const sheetTitle =
      (await resolveSheetTitle(
        sheets,
        companySheetId,
        resolved.position_name
      )) ||
      (await resolveSheetTitle(sheets, companySheetId, positionName))
    if (!sheetTitle) return null

    const detail = await sheets.spreadsheets.values.get({
      spreadsheetId: companySheetId,
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1:D200`,
    })

    return {
      position_name: sheetTitle.trim(),
      company: resolved.company,
      detail: parseDetailRows((detail.data.values || []) as string[][]),
    }
  } catch {
    return null
  }
}
