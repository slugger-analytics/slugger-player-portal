/**
 * Use on stub routes inside the widget shell so future pages inherit the same typography
 * and panel styling as Player Discovery Home.
 */
export function PortalPlaceholder({ title }: { title: string }) {
  return (
    <main className="px-4 pb-10 pt-1">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-black">{title}</h1>
      <div className="portal-panel-well max-w-lg">
        <p className="text-sm leading-relaxed text-neutral-600">
          This section is not built yet. Navigation and layout use the Player Discovery style
          so new features can match the home experience.
        </p>
      </div>
    </main>
  )
}
