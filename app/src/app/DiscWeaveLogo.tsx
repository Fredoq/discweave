type DiscWeaveLogoProps = Readonly<{
  size?: number
}>

export function DiscWeaveLogo({ size = 18 }: DiscWeaveLogoProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.25 7.25h15.5M4.25 12h15.5M4.25 16.75h15.5M8.25 4.25v15.5M15.75 4.25v15.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" fill="currentColor" r="2" />
      <path
        d="M7.5 12a4.5 4.5 0 0 1 9 0M6.2 12a5.8 5.8 0 0 1 11.6 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
    </svg>
  )
}
