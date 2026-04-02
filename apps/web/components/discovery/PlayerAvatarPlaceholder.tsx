import { User } from "lucide-react"

type Props = {
  size?: "md" | "sm"
}

const shell = {
  md: "h-[88px] w-[88px]",
  sm: "h-14 w-14",
} as const

const icon = {
  md: "h-10 w-10",
  sm: "h-7 w-7",
} as const

export function PlayerAvatarPlaceholder({ size = "md" }: Props) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-neutral-300 text-neutral-500 ${shell[size]}`}
      aria-hidden
    >
      <User className={`${icon[size]} opacity-75`} strokeWidth={1.5} />
    </div>
  )
}
