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
    <div className="h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[1.35fr_0.65fr]">
        <div
          className="relative hidden bg-cover bg-center lg:block"
          style={{ backgroundImage: "url('/login-hero.jpg.jpg')" }}>
          <div className="absolute inset-0 bg-slate-900/55" />
          <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,0.12),transparent_55%)]" />

          <div className="relative flex h-full flex-col justify-center px-10">
            <div className="whitespace-nowrap text-4xl font-extrabold tracking-wide text-white/95 xl:text-5xl">
              SAXCCU FILE MANAGEMENT SYSTEM
            </div>
            <div className="mt-4 max-w-md text-sm text-white/80">
              Secure file access, sharing, and document workflows across
              branches.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-slate-100 px-4 py-6 dark:bg-slate-900">
          <div className="w-full max-w-xs">
            <div className="flex flex-col items-center text-center">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-24 w-24 object-contain"
              />
              <div className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Samartex Co-Operative Credit Union Limited
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                Welcome to SFMS. Please sign in to your account
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <form onSubmit={onSubmit} className="space-y-4">
                {notice ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 whitespace-pre-wrap">
                    {notice}
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                    Username
                  </label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    type="text"
                    autoComplete="username"
                    placeholder="Percy"
                    required
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                    Password
                  </label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    required
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? "Signing in..." : "Log In"}
                </button>

                {error ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm text-rose-800 whitespace-pre-wrap">
                    {error}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
