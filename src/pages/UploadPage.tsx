import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { ApiError, apiFetchForm } from "../lib/api";
import { useWait } from "../context/WaitContext";
import { usePageTitle } from "../hooks/usePageTitle";

usePageTitle("Upload");

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
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
        <Link to="/">Back</Link>
      </div>

      <h1 style={{ marginTop: 12 }}>Upload</h1>

      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gap: 12, maxWidth: 600, margin: "0 auto" }}>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ padding: 10 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, borderRadius: 8 }}>
          {loading ? "Uploading..." : "Upload"}
        </button>

        {error ? (
          <div style={{ color: "tomato", whiteSpace: "pre-wrap" }}>{error}</div>
        ) : null}

        {result ? (
          <pre
            style={{
              background: "#111",
              padding: 12,
              borderRadius: 8,
              overflowX: "auto",
            }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </form>
    </div>
  );
}
