import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError, apiFetch } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

usePageTitle("OnlyOffice");

function useQueryParam(name: string): string {
  const { search } = useLocation();
  return useMemo(() => {
    const p = new URLSearchParams(search);
    return p.get(name) ?? "";
  }, [name, search]);
}

type OnlyOfficeConfigOut = {
  docserver_url: string;
  config: Record<string, any>;
};

export default function OnlyOfficeEditorPage() {
  const navigate = useNavigate();
  const filePath = useQueryParam("file_path");
  const holderRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docServerUrl, setDocServerUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!filePath) {
        setError("Missing file_path");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<OnlyOfficeConfigOut>(
          `/onlyoffice/config?file_path=${encodeURIComponent(filePath)}`,
          { method: "GET" },
          { auth: true },
        );

        if (cancelled) return;

        setDocServerUrl(res.docserver_url);

        // load OnlyOffice api.js
        const apiUrl = `${res.docserver_url.replace(/\/+$/, "")}/web-apps/apps/api/documents/api.js`;
        const existing = document.querySelector(
          `script[data-onlyoffice-api="${apiUrl}"]`,
        ) as HTMLScriptElement | null;

        const ensureScript = async () => {
          if (existing) return;
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = apiUrl;
            s.async = true;
            s.dataset.onlyofficeApi = apiUrl;
            s.onload = () => resolve();
            s.onerror = () =>
              reject(new Error("Failed to load OnlyOffice api.js"));
            document.body.appendChild(s);
          });
        };

        await ensureScript();

        if (cancelled) return;
        if (!holderRef.current) {
          throw new Error("Editor container not ready");
        }

        // cleanup any previous editor
        try {
          editorRef.current?.destroyEditor?.();
        } catch {
          // ignore
        }
        editorRef.current = null;

        const DocsAPI = (window as any).DocsAPI;
        if (!DocsAPI?.DocEditor) {
          throw new Error("OnlyOffice DocsAPI not available");
        }

        editorRef.current = new DocsAPI.DocEditor(
          holderRef.current.id,
          res.config,
        );
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(`${err.message}${err.bodyText ? ` - ${err.bodyText}` : ""}`);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to load editor",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      try {
        editorRef.current?.destroyEditor?.();
      } catch {
        // ignore
      }
      editorRef.current = null;
    };
  }, [filePath]);

  const holderId = "onlyoffice-editor-holder";

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Edit document
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            OnlyOffice
          </div>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
          Back
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-6 py-4">
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Loading editor…
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="h-full w-full" id={holderId} ref={holderRef} />
        </div>

        {docServerUrl ? (
          <div className="text-xs text-slate-400 dark:text-slate-500">
            DocServer: {docServerUrl}
          </div>
        ) : null}
      </div>
    </div>
  );
}
