import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, UploadCloud, FileText, X, CheckCircle2 } from "lucide-react";

import { ApiError, apiFetchForm } from "../lib/api";
import { useWait } from "../context/WaitContext";
import { usePageTitle } from "../hooks/usePageTitle";

type FileOut = {
  id: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number;
  branch_id: number;
  uploaded_by: number;
};

export default function UploadPage() {
  usePageTitle("Upload");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FileOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wait = useWait();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Please select a file");
      return;
    }

    setLoading(true);
    wait.start("Uploading file…");
    try {
      const form = new FormData();
      form.append("upload", file);
      const res = await apiFetchForm<FileOut>("/files/upload", form);
      setResult(res);
      setFile(null); // Reset after success
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
      } else {
        setError("Upload failed");
      }
    } finally {
      wait.stop();
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-emerald-primary transition-colors">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Dashboard
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Upload Asset</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
          Select a file to upload to the secure management system.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="relative">
          {!file ? (
            <label className="flex h-72 w-full cursor-pointer flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-slate-200 bg-white hover:border-emerald-primary/50 hover:bg-emerald-50/10 transition-all dark:border-slate-800 dark:bg-slate-950 group">
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <div className="mb-6 rounded-3xl bg-slate-50 p-5 text-slate-300 dark:bg-slate-900 group-hover:text-emerald-primary transition-colors group-hover:scale-110 duration-300">
                  <UploadCloud className="h-10 w-10" />
                </div>
                <p className="mb-2 text-lg font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">
                  Drop files here
                </p>
                <p className="text-xs text-slate-400 font-bold tracking-tight">
                  Supports all formats up to 50MB
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[40px] border border-slate-100 bg-white p-10 dark:border-slate-800 dark:bg-slate-950 shadow-xl">
              <div className="relative mb-6">
                <div className="rounded-[32px] bg-slate-50 p-6 text-emerald-primary dark:bg-slate-900">
                  <FileText className="h-14 w-14" />
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="absolute -right-3 -top-3 rounded-2xl bg-rose-50 p-2 text-rose-500 shadow-lg hover:bg-rose-100 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-center font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight truncate max-w-full px-4">{file.name}</p>
              <p className="text-xs text-slate-400 font-black uppercase tracking-[0.2em] mt-2">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-primary px-4 py-4 text-sm font-black text-white shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-[0.2em]">
          {loading ? "Processing..." : "Commence Upload"}
        </button>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-[32px] bg-emerald-50/50 p-6 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50">
            <div className="flex items-center gap-3 text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
              <CheckCircle2 className="h-6 w-6" />
              Upload Successful
            </div>
            <p className="mt-2 text-xs font-bold text-emerald-600/80 dark:text-emerald-500 italic">
              Asset synchronized as {result.file_name}
            </p>
          </div>
        ) : null}
      </form>
    </div>
  );
}
