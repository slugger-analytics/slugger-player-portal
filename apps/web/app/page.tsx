/** Landing route: send users straight to the Player Discovery dashboard. */

import { redirect } from "next/navigation"

export default function HomePage() {
  redirect("/dashboard")
}
