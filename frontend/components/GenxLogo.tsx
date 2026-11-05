// GenX double-helix mark: green and orange strands joined by multicolor rungs, tilted to the right.
export default function GenxLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <g transform="rotate(35 16 16)" strokeLinecap="round">
        <g strokeWidth="1">
          <path d="M11 2.5H21" stroke="#60A5FA" />
          <path d="M11 11.3H21" stroke="#A78BFA" />
          <path d="M11 20.7H21" stroke="#F472B6" />
          <path d="M11 29.5H21" stroke="#818CF8" />
        </g>
        <g strokeWidth="1.3">
          <path d="M21 2C21 6 11 7.5 11 11.3S21 16.5 21 20.7S11 26 11 30" stroke="#10B981" />
          <path d="M11 2C11 6 21 7.5 21 11.3S11 16.5 11 20.7S21 26 21 30" stroke="#F97316" />
        </g>
      </g>
    </svg>
  );
}
