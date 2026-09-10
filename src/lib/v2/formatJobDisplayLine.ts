import type { JobListItem } from "./getJobListLight"

/** Omit location when it duplicates text already in position_name. */
export function formatJobDisplayLine(job: JobListItem): string {
  const name = job.position_name.trim()
  const loc = job.location?.trim()
  if (!loc) return name

  const norm = (s: string) => s.replace(/\s+/g, " ").trim()
  const n = norm(name)
  const l = norm(loc)

  if (n === l || n.endsWith(l) || n.includes(l)) return name
  return `${name} — ${loc}`
}
