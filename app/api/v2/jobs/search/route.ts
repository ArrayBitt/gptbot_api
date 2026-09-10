import { NextRequest, NextResponse } from "next/server"
import { createSheetsClient } from "@/src/lib/createSheetsClient"
import { corsHeaders } from "@/src/lib/v2/constants"
import { searchJobs } from "@/src/lib/v2/searchJobs"
import { formatJobSearchReply, formatJobSearchResult } from "@/src/lib/v2/formatJobSearchResult"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || ""
  if (!q) {
    return NextResponse.json(
      { success: false, error: "q is required" },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    const sheets = createSheetsClient()
    const data = await searchJobs(sheets, q)

    return NextResponse.json(
      {
        success: true,
        data,
        reply: formatJobSearchReply(q, data),
        meta: { q, count: data.length },
        result: formatJobSearchResult(q, data),
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("v2 jobs/search error:", error)
    return NextResponse.json(
      { success: false, error: "failed to search jobs", result: "" },
      { status: 500, headers: corsHeaders }
    )
  }
}
