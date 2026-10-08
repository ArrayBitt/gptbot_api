import { readFileSync } from "fs"
import { resolve } from "path"
import { google, sheets_v4 } from "googleapis"

function loadCredentials(): object {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT
  if (raw) return JSON.parse(raw)

  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64
  if (b64) return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"))

  const path =
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
    "functions/gptbot/src/lib/service-account.json"

  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf-8"))
}

let cached: sheets_v4.Sheets | null = null

export function createSheetsClient(): sheets_v4.Sheets {
  if (cached) return cached

  const auth = new google.auth.GoogleAuth({
    credentials: loadCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })

  cached = google.sheets({ version: "v4", auth })
  return cached
}
