import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, CloudArrowUpIcon, DocumentIcon, XMarkIcon } from "@heroicons/react/24/outline";

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="group flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-primary-600 transition-colors dark:text-sky-400 dark:hover:text-primary-400">
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-sky-950 dark:text-sky-50">Upload Files</h1>
        <p className="text-sm text-sky-500 dark:text-sky-400">
          Select a file to upload to the management system.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="relative">
          {!file ? (
            <label className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sky-200 bg-white hover:border-primary-400 hover:bg-sky-50/50 transition-all dark:border-sky-800 dark:bg-sky-950 dark:hover:border-primary-500/50 dark:hover:bg-sky-900/20">
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <div className="mb-4 rounded-full bg-primary-50 p-3 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                  <CloudArrowUpIcon className="h-8 w-8" />
                </div>
                <p className="mb-2 text-sm font-semibold text-sky-950 dark:text-sky-50">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-sky-500 dark:text-sky-400">
                  Any file type supported (Max. 50MB)
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-sky-100 bg-white p-8 dark:border-sky-800 dark:bg-sky-950">
              <div className="relative mb-4">
                <div className="rounded-2xl bg-sky-50 p-4 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                  <DocumentIcon className="h-12 w-12" />
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-red-100 p-1 text-red-600 shadow-sm hover:bg-red-200 dark:bg-red-900 dark:text-red-400">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <p className="text-center font-medium text-sky-950 dark:text-sky-50">{file.name}</p>
              <p className="text-xs text-sky-500 dark:text-sky-400">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {loading ? "Uploading..." : "Start Upload"}
        </button>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-2xl bg-green-50 p-4 dark:bg-green-950/30">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-400">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              Upload Successful!
            </div>
            <p className="mt-1 text-xs text-green-700 dark:text-green-500">
              File has been saved as {result.file_name}
            </p>
          </div>
        ) : null}
      </form>
    </div>
  );
}
