import Link from "next/link"

/** Standalone auth entry — same page background token as the rest of the app. */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-portal-page px-4 py-12">
      <div className="w-full max-w-md rounded-portal border border-portal-chrome-border bg-white p-8 shadow-portal">
        <h1 className="text-2xl font-bold text-black">Login</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Standalone sign-in is not wired yet. Use{" "}
          <Link href="/dashboard" className="font-semibold text-portal-accent hover:underline">
            Player Discovery Home
          </Link>{" "}
          when running the widget experience.
        </p>
      </div>
    </div>
  )
}
