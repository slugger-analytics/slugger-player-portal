// PURPOSE: Role-based routing — redirect users to the correct experience by UserRole after login.
// Managers/Coaches -> /dashboard; Analysts -> /player/compare; Players/Agents -> /profile/submit.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Read session/role; redirect to /(auth)/login if unauthenticated;
  // if authenticated, redirect by role: Manager -> /dashboard, Analyst -> /player/compare, Player|Agent -> /profile/submit.
  return NextResponse.next();
}

export const config = {
  matcher: [], // Add route patterns to protect
};
