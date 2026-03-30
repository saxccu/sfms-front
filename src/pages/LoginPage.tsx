import { useState } from "react";
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    wait.start("Authenticating...");
    try {
      const res = await login(username, password);
      setAccessToken(res.access_token);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Login failed. Please check your connection.");
      }
    } finally {
      wait.stop();
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-[#FAF9F6] text-slate-900 font-sans">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left Side: Aesthetic Background & Branding */}
        <div className="relative hidden bg-cover bg-center lg:block" style={{ backgroundImage: 'url("/login-hero.jpg.jpg")' }}>
          <div className="absolute inset-0 bg-emerald-950/40" />
          <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,0.12),transparent_55%)]" />

          <div className="relative flex h-full flex-col justify-end p-16">
            <div className="text-4xl font-bold tracking-tight text-white xl:text-6xl">
              Secure. Seamless. <br />
              <span className="text-emerald-400">Connected.</span>
            </div>
            <div className="mt-6 max-w-lg text-lg text-white/90 font-medium">
              The Samartex Co-Operative Credit Union File Management System provides high-security document workflows across all branches.
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex items-center justify-center bg-[#FAF9F6] px-4 py-6">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-emerald-950 uppercase tracking-widest">Welcome Back</h1>
              <p className="mt-2 text-sm text-slate-500 font-bold">Please enter your credentials to access SFMS</p>
            </div>

            <div className="mt-10 rounded-[2.5rem] bg-white p-10 shadow-xl shadow-emerald-900/5 ring-1 ring-black/5">
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="Enter your username"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 ring-1 ring-rose-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-emerald-900 py-4 text-sm font-black text-white transition-all hover:bg-emerald-800 hover:shadow-lg hover:shadow-emerald-900/20 disabled:cursor-not-allowed disabled:opacity-60 uppercase tracking-[0.2em]"
                >
                  {loading ? "Authenticating..." : "Log In to SFMS"}
                </button>
              </form>
            </div>

            <p className="mt-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              © 2026 Samartex Co-Operative Credit Union.<br /> All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
