import { sheets_v4 } from "googleapis"
import { getOpenPositionRows } from "./getOpenPositionRows"

export type JobSearchItem = {
  position_name: string
  company: string
  score: number
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFKC").trim().replace(/\s+/g, "")
}

/**
 * Map casual Thai job phrases → sheet keywords.
 * Bot prompt also normalizes these, but search must work even when
 * the bot forwards the raw user text (e.g. "ขับรถนาย").
 */
const QUERY_SYNONYMS: Array<{ test: (n: string) => boolean; terms: string[] }> = [
  {
    test: (n) =>
      /ขับ(รถ)?นาย|ขับให้นาย|นายญี่ปุ่น|นายไทย|ขับรถผู้บริหา|ขับผู้บริหาร|ผู้บริหาร/.test(
        n
      ),
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
  const openPositions = await getOpenPositionRows(sheets)

  return openPositions
    .map(({ position_name, company }) => {
      const name = normalize(position_name)
      let score = 0
      for (const q of normalizedTerms) {
        score = Math.max(score, scoreAgainst(name, company, q))
      }
      return { position_name, company, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
}
