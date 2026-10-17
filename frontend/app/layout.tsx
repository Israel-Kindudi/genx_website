import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GenX – Where Markets Meet Genetics",
  description:
    "GenX models markets as chromosome-like data structures and evolves strategies with genetic algorithms.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}