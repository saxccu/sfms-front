import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { ArrowLeftIcon, CloudIcon } from "@heroicons/react/24/outline";

import { ApiError, apiFetch } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

function useQueryParam(name: string): string {
  const { search } = useLocation();
  return useMemo(() => {
    const p = new URLSearchParams(search);
    return p.get(name) ?? "";
  }, [name, search]);
}

/** The subset of the OnlyOffice DocsAPI surface this page actually uses. */
type DocEditorInstance = {
  destroyEditor?: () => void;
};

type DocsApi = {
  DocEditor: new (elementId: string, config: unknown) => DocEditorInstance;
};

type OnlyOfficeConfigOut = {
  docserver_url: string;
  config: Record<string, unknown>;
};

export default function OnlyOfficeEditorPage() {
  usePageTitle("OnlyOffice");
  const filePath = useQueryParam("file_path");
  const holderRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<DocEditorInstance | null>(null);

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

        const DocsAPI = (window as unknown as { DocsAPI?: DocsApi }).DocsAPI;
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-sky-950">
      {/* Mini Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-sky-900/50 px-3 py-2.5 backdrop-blur-md sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            to="/file-manager"
            className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-sky-200 transition-colors hover:text-white">
            <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Files
          </Link>
          <div className="hidden h-4 w-px bg-white/10 sm:block" />
          <div className="flex min-w-0 items-center gap-2 text-white">
            <CloudIcon className="h-5 w-5 text-primary-400" />
            <span className="max-w-[140px] truncate text-sm font-bold sm:max-w-md">
              {filePath.split("/").pop() || "Document Editor"}
            </span>
          </div>
        </div>

        <div className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-400 sm:flex">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Live Collaboration
        </div>
      </div>

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-sky-950/80 backdrop-blur-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent shadow-xl" />
            <p className="mt-4 text-sm font-bold text-white tracking-widest uppercase">Opening Editor...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-red-950/50 p-8 backdrop-blur-xl text-center">
              <h3 className="text-xl font-bold text-white mb-2">Editor Error</h3>
              <p className="text-sm text-red-200 mb-6">{error}</p>
              <Link to="/file-manager" className="inline-flex rounded-2xl bg-white px-6 py-2.5 text-sm font-bold text-red-950 hover:bg-sky-50 transition-colors">
                Return to Files
              </Link>
            </div>
          </div>
        )}

        <div className="h-full w-full bg-white" id={holderId} ref={holderRef} />
      </div>

      {docServerUrl && (
        <div className="flex items-center justify-between gap-2 bg-sky-900/80 px-3 py-1.5 text-[10px] font-medium text-sky-400 sm:px-6">
          <span className="truncate">{docServerUrl}</span>
          <span>OnlyOffice Enterprise Edition</span>
        </div>
      )}
    </div>
  );
}
