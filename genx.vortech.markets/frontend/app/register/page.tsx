import type { Metadata } from "next";
import AuthPage from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "Create an account",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterPage() {
  return <AuthPage initialMode="register" />;
}
