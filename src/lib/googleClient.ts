import { google } from "googleapis"

const raw = process.env.GOOGLE_SERVICE_ACCOUNT
if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT env var is not set")

const credentials = JSON.parse(raw)

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
})

export const sheets = google.sheets({ version: "v4", auth })
