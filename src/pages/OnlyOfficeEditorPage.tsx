import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { ArrowLeft, Cloud, ShieldCheck } from "lucide-react";

import { ApiError, apiFetch } from "../lib/api";
import { usePageTitle } from "../hooks/usePageTitle";

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
  usePageTitle("OnlyOffice");
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
    <div className="flex h-screen w-screen flex-col bg-slate-950 overflow-hidden font-inter">
      {/* Mini Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/40 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-6">
          <Link
            to="/file-manager"
            className="flex items-center gap-2 text-slate-400 hover:text-emerald-primary transition-colors text-xs font-black uppercase tracking-widest group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <div className="flex items-center gap-3 text-white">
            <Cloud className="h-5 w-5 text-emerald-primary" />
            <span className="text-sm font-black truncate max-w-[200px] sm:max-w-md uppercase tracking-tight">
              {filePath.split('/').pop() || "Document Editor"}
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-[10px] uppercase tracking-widest font-black text-emerald-primary">
          <div className="h-2 w-2 rounded-full bg-emerald-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Live Session
        </div>
      </div>

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-primary border-t-transparent shadow-[0_0_20px_rgba(16,185,129,0.2)]" />
            <p className="mt-6 text-[10px] font-black text-white tracking-[0.3em] uppercase">Initializing Editor...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-[40px] border border-rose-500/20 bg-slate-900/80 p-10 backdrop-blur-xl text-center shadow-2xl">
              <h3 className="text-xl font-black text-white mb-3 uppercase tracking-widest">Editor Error</h3>
              <p className="text-sm font-bold text-rose-200 mb-8">{error}</p>
              <Link to="/file-manager" className="inline-flex rounded-2xl bg-white px-8 py-3 text-xs font-black text-slate-950 hover:bg-emerald-50 transition-all uppercase tracking-widest shadow-lg shadow-black/20">
                Return to Files
              </Link>
            </div>
          </div>
        )}

        <div className="h-full w-full bg-white" id={holderId} ref={holderRef} />
      </div>

      {docServerUrl && (
        <div className="px-6 py-2 bg-slate-900/60 text-[9px] text-slate-500 font-black uppercase tracking-widest flex justify-between border-t border-white/5">
          <span className="flex items-center gap-2 italic">{docServerUrl}</span>
          <span className="flex items-center gap-2">
            <ShieldCheck size={12} className="text-emerald-primary" />
            OnlyOffice Enterprise Security Active
          </span>
        </div>
      )}
    </div>
  );
}
