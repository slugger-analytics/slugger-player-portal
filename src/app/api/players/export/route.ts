// PURPOSE: API route for Coaches to export filtered player lists as CSV.
import { NextResponse } from "next/server";

export async function GET() {
  // Auth + role check (Manager/Coach); apply filters from query; use export.ts; return CSV.
  return NextResponse.json({ message: "Export not implemented" });
}
