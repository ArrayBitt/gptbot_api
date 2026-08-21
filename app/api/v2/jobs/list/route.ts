import { NextRequest, NextResponse } from "next/server"
import { createSheetsClient } from "@/src/lib/createSheetsClient"
import { corsHeaders } from "@/src/lib/v2/constants"
import { formatJobListResult, formatJobListReply, formatZonesReply } from "@/src/lib/v2/formatJobListResult"
import {
  getJobListLight,
  summarizeZones,
  uniqueZones,
} from "@/src/lib/v2/getJobListLight"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  try {
    const light = req.nextUrl.searchParams.get("light") === "1"
    const sheets = createSheetsClient()
    const data = await getJobListLight(sheets, { withMeta: !light })
    const zone_summary = summarizeZones(data)
    const zones = uniqueZones(data)

    const payload = {
      success: true,
      data,
      reply_zones: formatZonesReply(data, zone_summary),
      reply_jobs: formatJobListReply(data),
      meta: {
        count: data.length,
        zones,
        zone_count: zones.length,
        zone_summary,
      },
      result: formatJobListResult(data, zone_summary),
    }
    return NextResponse.json(payload, { headers: corsHeaders })
  } catch (error) {
    console.error("v2 jobs/list error:", error)
    return NextResponse.json(
      { success: false, error: "failed to load job list", result: "" },
      { status: 500, headers: corsHeaders }
    )
  }
}
