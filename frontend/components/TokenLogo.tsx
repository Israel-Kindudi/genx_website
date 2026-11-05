import GenxLogo from "@/components/GenxLogo";

const SIZES = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

export default function TokenLogo({
  size = "sm",
  className = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return <GenxLogo className={`${SIZES[size]} ${className}`} />;
}
