import { sheets_v4 } from "googleapis"
import { getOpenPositionRows } from "./getOpenPositionRows"
import { getJobDetail } from "./getJobDetail"

export type JobSearchItem = {
  position_name: string
  company: string
  score: number
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFKC").trim().replace(/\s+/g, "")
}

/**
 * Nationality of the "นาย"/ผู้บริหาร a position serves, when the user asks
 * for one specifically (e.g. "นายคนไทย", "นายญี่ปุ่น", "นายรัสเซีย").
 */
const NATIONALITY_TERMS = [
  "ไทย",
  "ญี่ปุ่น",
  "จีน",
  "เกาหลี",
  "ฝรั่งเศส",
  "รัสเซีย",
  "อเมริกัน",
  "อังกฤษ",
  "อินเดีย",
  "เยอรมัน",
]
const NORMALIZED_NATIONALITY_TERMS = NATIONALITY_TERMS.map(normalize)

/**
 * Map casual Thai job phrases → sheet keywords.
 * Bot prompt also normalizes these, but search must work even when
 * the bot forwards the raw user text (e.g. "ขับรถนาย").
 */
const QUERY_SYNONYMS: Array<{ test: (n: string) => boolean; terms: string[] }> = [
  {
    // "นาย" + any nationality word, in any order/with words in between
    // (นายไทย, นายคนไทย, นายรัสเซีย, ขับรถนายคนญี่ปุ่น, ...) — not just the
    // exact "นายไทย"/"นายญี่ปุ่น" spelling.
    test: (n) =>
      /ขับ(รถ)?นาย|ขับให้นาย|ขับรถผู้บริหา|ขับผู้บริหาร|ผู้บริหาร/.test(n) ||
      (n.includes("นาย") && NORMALIZED_NATIONALITY_TERMS.some((t) => n.includes(t))),
    terms: ["ผู้บริหาร", "ขับรถผู้บริหาร"],
  },
  {
    test: (n) =>
      /คนขับรถส่วนกลาง|ขับรถรับส่ง|รถตู้รับส่ง|ขับรถตู้|ส่วนกลาง/.test(n),
    terms: ["ส่วนกลาง"],
  },
  {
    test: (n) => /สแปร์|spare/.test(n),
    terms: ["สแปร์", "spare"],
  },
  {
    test: (n) => /งานลูกค้า|ลูกค้า|client/.test(n),
    terms: ["ลูกค้า", "client"],
  },
]

/** Expand user query into match terms (original + synonyms). */
export function expandSearchQuery(query: string): string[] {
  const raw = query.normalize("NFKC").trim()
  if (!raw) return []

  const n = normalize(raw)
  const terms = new Set<string>([raw])

  for (const { test, terms: syns } of QUERY_SYNONYMS) {
    if (test(n)) {
      for (const t of syns) terms.add(t)
    }
  }

  return [...terms]
}

/**
 * When a nationality word is present in the query, this must be a hard
 * (AND) filter on top of the normal OR-style term scoring below —
 * otherwise "นายคนไทย" still matches the generic "ผู้บริหาร" bucket and
 * returns executive positions of every nationality, since scoring takes
 * the max across terms.
 */
function extractNationality(query: string): string | null {
  const raw = query.normalize("NFKC")
  for (const term of NATIONALITY_TERMS) {
    if (raw.includes(term)) return term
  }
  return null
}

const NATIONALITY_FIELD_PREFIX = "สัญชาติของนาย"

/**
 * Whether a position matches the requested nationality — checked straight
 * from that position's own detail sheet (item "สัญชาติของนาย/ผู้บริหารที่
 * ต้องดูแล"), the single source of truth. No separate synced column in
 * Global_Open_Position — this stays cheap because it only runs for the
 * small subset of candidates that already passed the term-score filter
 * below (e.g. the "ผู้บริหาร" bucket), not every open position, and
 * getJobDetail caches successful lookups for 60s.
 */
async function matchesNationality(
  sheets: sheets_v4.Sheets,
  item: { position_name: string; company: string },
  nationality: string
): Promise<boolean> {
  // Legacy convention: some foreign-boss titles already spell it out
  // directly, e.g. "...ชาวฝรั่งเศส" / "...ชาวรัสเซีย".
  if (normalize(item.position_name).includes(normalize(nationality))) return true

  const detail = await getJobDetail(sheets, item.position_name, item.company)
  if (!detail) return false

  const key = Object.keys(detail.detail).find((k) =>
    k.normalize("NFKC").trim().startsWith(NATIONALITY_FIELD_PREFIX)
  )
  if (!key) return false

  return normalize(detail.detail[key]).includes(normalize(nationality))
}

function scoreAgainst(name: string, company: string, q: string): number {
  if (!q) return 0
  if (name === q) return 1
  if (name.includes(q) || q.includes(name)) return 0.8
  if (normalize(company).includes(q)) return 0.4
  return 0
}

export async function searchJobs(
  sheets: sheets_v4.Sheets,
  query: string
): Promise<JobSearchItem[]> {
  const terms = expandSearchQuery(query)
  if (terms.length === 0) return []

  const normalizedTerms = terms.map(normalize).filter(Boolean)
  const nationality = extractNationality(query)
  const openPositions = await getOpenPositionRows(sheets)

  const scored = openPositions
    .map(({ position_name, company }) => {
      const name = normalize(position_name)
      let score = 0
      for (const q of normalizedTerms) {
        score = Math.max(score, scoreAgainst(name, company, q))
      }
      return { position_name, company, score }
    })
    .filter((item) => item.score > 0)

  if (!nationality) {
    return scored.sort((a, b) => b.score - a.score)
  }

  const checked = await Promise.all(
    scored.map(async (item) => ({
      item,
      ok: await matchesNationality(sheets, item, nationality),
    }))
  )

  return checked
    .filter((x) => x.ok)
    .map((x) => x.item)
    .sort((a, b) => b.score - a.score)
}
