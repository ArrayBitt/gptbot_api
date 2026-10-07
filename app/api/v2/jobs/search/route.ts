import { NextRequest, NextResponse } from "next/server"
import { createSheetsClient } from "@/src/lib/createSheetsClient"
import { corsHeaders } from "@/src/lib/v2/constants"
import { searchJobs } from "@/src/lib/v2/searchJobs"
import { formatJobSearchReply, formatJobSearchResult } from "@/src/lib/v2/formatJobSearchResult"
import { noDataFields } from "@/src/lib/v2/fallbackReply"

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

    if (data.length === 0) {
      const nd = noDataFields("search_empty", q)
      return NextResponse.json(
        {
          success: true,
          data,
          // `reply` = fallback too, so a bot that only copies `reply` still pushes to the apply form.
          reply: nd.reply_fallback,
          meta: { q, count: 0 },
          result: ["COPY_THIS_REPLY (NO_DATA — send as-is):", nd.reply_fallback].join("\n"),
          ...nd,
        },
        { headers: corsHeaders }
      )
    }

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
