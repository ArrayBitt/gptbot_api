import type { JobListItem, ZoneSummary } from "./getJobListLight"
import { formatJobDisplayLine } from "./formatJobDisplayLine"

function buildZonesReply(data: JobListItem[], zoneSummary: ZoneSummary[]) {
  const lines = [
    `ตอนนี้มีตำแหน่งงานขับรถเปิดรับทั้งหมด ${data.length} ตำแหน่งค่ะ`,
    "",
  ]
  for (const { zone, count } of zoneSummary) {
    lines.push(`- ${zone} (${count} ตำแหน่ง)`)
  }
  lines.push("")
  lines.push("สนใจโซนไหนเป็นพิเศษไหมคะ?")
  return lines.join("\n")
}

function buildJobListReply(data: JobListItem[]) {
  const lines = [
    `ตอนนี้มีตำแหน่งงานขับรถเปิดรับ ${data.length} ตำแหน่งค่ะ`,
    "",
  ]
  data.forEach((job, i) => {
    // User-facing line: position_name + location ONLY.
    // Never leak internal fields like company= here — that lives in
    // RAW_JOB_LIST below, for jobs_detail params, not for display.
    lines.push(`${i + 1}. ${formatJobDisplayLine(job)}`)
  })
  lines.push("")
  lines.push("สนใจตำแหน่งไหนเป็นพิเศษไหมคะ?")
  return lines.join("\n")
}

export function formatJobListResult(
  data: JobListItem[],
  zoneSummary: ZoneSummary[]
): string {
  const zonesReply = buildZonesReply(data, zoneSummary)
  const jobsReply = buildJobListReply(data)

  const jobLines = data.map(
    (job, i) => `${i + 1}. ${formatJobDisplayLine(job)} | company=${job.company}`
  )

  return [
    "COPY_THIS_REPLY_ZONES (send to user as-is for zone/count questions):",
    zonesReply,
    "",
    "COPY_THIS_REPLY_JOBS (send to user as-is for job list questions):",
    jobsReply,
    "",
    `TOTAL_COUNT: ${data.length}`,
    "",
    "RAW_JOB_LIST (for jobs_detail params):",
    ...jobLines,
  ].join("\n")
}

export function formatZonesReply(
  data: JobListItem[],
  zoneSummary: ZoneSummary[]
): string {
  return buildZonesReply(data, zoneSummary)
}

export function formatJobListReply(data: JobListItem[]): string {
  return buildJobListReply(data)
}
