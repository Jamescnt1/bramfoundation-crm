import { NextResponse } from "next/server";
import { searchFoundationCrm } from "@/lib/services/global-search";
import type { GlobalSearchResponse } from "@/lib/search/types";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json<GlobalSearchResponse>({ query, results: [] });
  }

  try {
    const results = await searchFoundationCrm(query);
    return NextResponse.json<GlobalSearchResponse>({ query, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search is unavailable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
