"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await api.post("/api/auth/register", {
          email,
          password,
          full_name: fullName,
        });
      }

      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);

      const res = await api.post("/api/auth/token", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = res.data.access_token;
      if (!token) throw new Error("No access token returned");

      saveToken(token);

      // Give the browser a tick to persist the token
      await new Promise((r) => setTimeout(r, 50));

      // Hard navigate so the dashboard always sees the token
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "Authentication failed"
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧬</div>
          <h1 className="text-3xl font-bold gradient-text">GenX</h1>
          <p className="text-gray-400 mt-2">
            {mode === "login"
              ? "Sign in to your account"
              : "Create your account"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-[#1a1a2e] p-8 rounded-2xl border border-[#2d3748]"
        >
          {mode === "register" && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-[#0a0a1a] border border-[#2d3748] rounded-lg focus:border-[#00ff88] outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#0a0a1a] border border-[#2d3748] rounded-lg focus:border-[#00ff88] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#0a0a1a] border border-[#2d3748] rounded-lg focus:border-[#00ff88] outline-none"
            />
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-gray-400">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                onClick={() => setMode("register")}
                className="text-[#00ff88]"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already registered?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-[#00ff88]"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}