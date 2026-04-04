import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useWait } from "../context/WaitContext";
import { ApiError } from "../lib/api";
import { login } from "../lib/auth";
import { setAccessToken } from "../lib/storage";

import { usePageTitle } from "../hooks/usePageTitle";

export default function LoginPage() {
  usePageTitle("Login");
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const wait = useWait();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const reason = localStorage.getItem("sfms_signout_reason");
      if (reason === "idle") {
        setNotice(
          "You have been signed out due to inactivity. Please sign in again.",
        );
      }
      if (reason) {
        localStorage.removeItem("sfms_signout_reason");
      }
    } catch {
      // ignore
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    wait.start("Signing in…");

    try {
      const token = await login(username, password);
      setAccessToken(token.access_token);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Login failed");
      }
    } finally {
      wait.stop();
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-brand-50 text-slate-900">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
        <div
          className="relative hidden bg-cover bg-center lg:block"
          style={{ backgroundImage: "url('/login-hero.jpg.jpg')" }}>
          <div className="absolute inset-0 bg-brand-950/45" />
          <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,0.12),transparent_55%)]" />

          <div className="relative flex h-full flex-col justify-end p-16">
            <div className="text-4xl font-bold tracking-tight text-white xl:text-6xl">
              Secure. Seamless. <br />
              <span className="text-brand-400">Connected.</span>
            </div>
            <div className="mt-6 max-w-lg text-lg text-white/90">
              The Samartex Co-Operative Credit Union File Management System
              provides high-security document workflows across all branches.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-brand-50 px-4 py-6">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-900">
                Welcome Back
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Please enter your credentials to access SFMS
              </p>
            </div>

            <div className="mt-10 rounded-[2.5rem] bg-white p-10 shadow-xl shadow-brand-900/8 ring-1 ring-black/5">
              <form onSubmit={onSubmit} className="space-y-6">
                {notice ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {notice}
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Username
                  </label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-brand-800 py-4 text-sm font-bold text-white transition-all hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-900/25 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? "Signing in..." : "Log In to SFMS"}
                </button>

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {error}
                  </div>
                ) : null}
              </form>
            </div>

            <p className="mt-8 text-center text-xs text-slate-400">
              © {new Date().getFullYear()} Samartex Co-Operative Credit Union.
              <br /> All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
