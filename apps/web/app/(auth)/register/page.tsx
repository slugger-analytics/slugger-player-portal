import Link from "next/link"

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-portal-page px-4 py-12">
      <div className="w-full max-w-md rounded-portal border border-portal-chrome-border bg-white p-8 shadow-portal">
        <h1 className="text-2xl font-bold text-black">Register</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Registration is not configured yet.{" "}
          <Link href="/dashboard" className="font-semibold text-portal-accent hover:underline">
            Go to Player Discovery
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
