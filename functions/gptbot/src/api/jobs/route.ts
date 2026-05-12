import { NextRequest, NextResponse } from "next/server"
import { getOpenJobs } from "@/src/lib/getOpenJobs"

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search") || ""
    const data = await getOpenJobs(search)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("API ERROR:", error)
    return NextResponse.json({ success: false })
  }
}
