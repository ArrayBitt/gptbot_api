import type { JobSearchItem } from "./searchJobs"

const MAX_SHOWN = 5

function buildSearchReply(query: string, data: JobSearchItem[]) {
  if (data.length === 0) {
    return [
      `ขออภัยค่ะ ไม่พบตำแหน่งงานขับรถที่ตรงกับ "${query}" ในระบบตอนนี้ค่ะ`,
      "ลองพิมพ์ชื่อประเภทงานขับรถอื่น หรือให้ดูตำแหน่งที่เปิดรับทั้งหมดก็ได้ค่ะ",
    ].join("\n")
  }

  const lines = [`พบตำแหน่งที่เกี่ยวข้องกับ "${query}" ดังนี้ค่ะ`, ""]
  data.slice(0, MAX_SHOWN).forEach((item, i) => {
    // User-facing line: position_name ONLY.
    // company= is internal — kept in RAW_SEARCH_RESULT below for jobs_detail
    // params, never mixed into text shown to the user.
    lines.push(`${i + 1}. ${item.position_name}`)
  })
  lines.push("")
  lines.push("สนใจตำแหน่งไหนเป็นพิเศษไหมคะ?")
  return lines.join("\n")
}

export function formatJobSearchReply(query: string, data: JobSearchItem[]): string {
  return buildSearchReply(query, data)
}

export function formatJobSearchResult(query: string, data: JobSearchItem[]): string {
  const reply = buildSearchReply(query, data)
  const rawLines = data.map(
    (item, i) => `${i + 1}. position_name=${item.position_name} | company=${item.company}`
  )

  return [
    "COPY_THIS_REPLY (send to user as-is for search result questions):",
    reply,
    "",
    `TOTAL_COUNT: ${data.length}`,
    "",
    "RAW_SEARCH_RESULT (for jobs_detail params):",
    ...rawLines,
  ].join("\n")
}
