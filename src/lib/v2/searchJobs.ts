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


export async function searchJobs(
  sheets: sheets_v4.Sheets,
  query: string
): Promise<JobSearchItem[]> {
  const q = normalize(query)
  if (!q) return []

  const openPositions = await getOpenPositionRows(sheets)

  return openPositions
    .map(({ position_name, company }) => {
      const name = normalize(position_name)
      let score = 0
      if (name === q) score = 1
      else if (name.includes(q) || q.includes(name)) score = 0.8
      else if (normalize(company).includes(q)) score = 0.4
      return { position_name, company, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
}
