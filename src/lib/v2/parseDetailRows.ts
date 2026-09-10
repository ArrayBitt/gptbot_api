export function parseDetailRows(rows: string[][]): Record<string, string> {
  const formatted: Record<string, string> = {}

  for (const row of rows) {
    const key = row[1]
    const value = row[2]
    if (key && value && key !== "รายการ" && !key.includes("SECTION")) {
      formatted[key] = value
    }
  }

  return formatted
}
