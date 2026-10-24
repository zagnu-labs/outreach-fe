"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, Me, Snapshot, api, clearSession, getSession, query } from "@/lib/api";

type Flash = { text: string; bad: boolean };

export default function Page() {
  return (
    <Suspense>
      <Queue />
    </Suspense>
  );
}

function Queue() {
  const router = useRouter();
  const params = useSearchParams();
  const listF = params.get("list") || "";
  const senderF = params.get("sender") || "";

  const [me, setMe] = useState<Me | null>(null);
  const [s, setS] = useState<Snapshot | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy to clipboard");
  const msgRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }
    api<Me>("/me")
      .then((m) => (m.user ? setMe(m) : router.replace("/name")))
      .catch((e: ApiError) => setFlash({ text: e.message, bad: true }));
  }, [router]);

  useEffect(() => {
    if (!me) return;
    api<Snapshot>("/state" + query(listF, senderF))
      .then(setS)
      .catch((e: ApiError) => setFlash({ text: e.message, bad: true }));
  }, [me, listF, senderF]);

  const setFilter = useCallback(
    (key: "list" | "sender", value: string) => {
      const list = key === "list" ? value : listF;
      const sender = key === "sender" ? value : senderF;
      router.replace("/" + query(list, sender));
    },
    [router, listF, senderF],
  );

  function fallbackCopy(text: string): boolean {
    const ta = msgRef.current;
    if (!ta) return false;
    ta.removeAttribute("readonly");
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.setAttribute("readonly", "");
    return ok;
  }

  function copied(ok: boolean) {
    setCopyLabel(ok ? "Copied" : "Press and hold the text to copy");
    setTimeout(() => setCopyLabel("Copy to clipboard"), 2000);
  }

  function copy() {
    const text = s?.task?.message || "";
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => copied(true),
        () => copied(fallbackCopy(text)),
      );
    } else {
      copied(fallbackCopy(text));
    }
  }

  async function act(status: "sent" | "skipped" | "failed") {
    if (busy || !s?.task) return;
    setBusy(true);
    try {
      const next = await api<Snapshot>(`/tasks/${s.task.id}/${status}` + query(listF, senderF), {
        method: "POST",
        body: { note },
      });
      setS(next);
      setNote("");
      setFlash(next.notice ? { text: next.notice, bad: false } : null);
    } catch (e) {
      const err = e as ApiError;
      setFlash({
        text: err.status === 0 ? "Could not save. Check your connection and try again." : err.message,
        bad: true,
      });
    }
    setBusy(false);
    window.scrollTo(0, 0);
  }

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ message: string; error: boolean; state: Snapshot }>("/refresh", { method: "POST" });
      setS(r.state);
      setFlash({ text: r.message, bad: r.error });
    } catch (e) {
      setFlash({ text: (e as ApiError).message, bad: true });
    }
    setBusy(false);
  }

  async function logout() {
    try {
      await api("/logout", { method: "POST" });
    } catch {}
    clearSession();
    router.replace("/login");
  }

  const task = s?.task;
  const showFilters = !!s && (s.lists.length > 0 || s.senders.length > 0 || !!listF || !!senderF);

  return (
    <>
      <h1>
        Today&apos;s <em>queue.</em>
      </h1>
      {me && s?.platform && (
        <p className="muted">
          {me.user} · {s.platform === "instagram" ? "Instagram" : "X"} DMs
        </p>
      )}
      {flash && (
        <div className={flash.bad ? "flash err" : "flash"} role="status">
          {flash.text}
        </div>
      )}
      {showFilters && (
        <div className="filters">
          <select aria-label="Filter by list" value={listF} onChange={(e) => setFilter("list", e.target.value)}>
            <option value="">All lists</option>
            {s.lists.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <select aria-label="Filter by sender account" value={senderF} onChange={(e) => setFilter("sender", e.target.value)}>
            <option value="">All accounts</option>
            {s.senders.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      )}

      {s &&
        (task ? (
          <div className="card">
            <div className="muted">
              {s.left} of {s.total} left
            </div>
            <div className="who">{task.name}</div>
            <div className="meta">
              <span className="badge">{task.platform}</span>
              <span className="chip">{task.handle}</span>
              {task.list && <span className="chip">{task.list}</span>}
            </div>
            {task.sender && <div className="from">Send from {task.sender}</div>}
            <textarea className="msg" ref={msgRef} value={task.message} readOnly />
            <button className="btn primary" type="button" onClick={copy}>
              {copyLabel}
            </button>
            <a className="btn primary" href={task.link} target="_blank" rel="noopener noreferrer">
              Open {task.platform} profile
            </a>
            <button className="btn done" type="button" disabled={busy} onClick={() => act("sent")}>
              Mark as sent
            </button>
            <input
              className="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder={
                s.notes_saved === false
                  ? "Notes are not saved for this lead list"
                  : "Note for Skip or Failed (optional)"
              }
              aria-label="Note (optional)"
              autoComplete="off"
            />
            <div className="row2">
              <button className="btn ghost small" type="button" disabled={busy} onClick={() => act("skipped")}>
                Skip
              </button>
              <button className="btn ghost small" type="button" disabled={busy} onClick={() => act("failed")}>
                Failed
              </button>
            </div>
          </div>
        ) : (
          <div className="card caught">
            <div className="check" aria-hidden="true">
              ✓
            </div>
            <b>All caught up</b>
            <span className="muted">Nothing left to send for now.</span>
          </div>
        ))}

      {s && (
        <>
          {s.limit_notes.map((n) => (
            <div className="limit" key={n}>
              {n}
            </div>
          ))}
          <div className="status muted">
            <span>{s.queued} queued</span>
            <span>{s.sent_today} sent today</span>
            {s.mode === "sheet" ? (
              <>
                <span>{s.rows_need_fixing ?? 0} rows need fixing</span>
                {s.last_synced && <span>synced {s.last_synced.slice(11, 16)} UTC</span>}
              </>
            ) : (
              <span>{s.waiting} waiting to notify</span>
            )}
          </div>
          {s.sync_error && <div className="limit">{s.sync_error}</div>}
          {!!s.bad_rows?.length && (
            <details id="badrows">
              <summary className="muted">Rows to fix in the sheet</summary>
              <ul>
                {s.bad_rows.map((b) => (
                  <li key={b.row}>
                    Row {b.row}: {b.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {me && (
        <>
          <button className="btn ghost small" type="button" disabled={busy} onClick={refresh}>
            Refresh
          </button>
          <a className="btn ghost small" href="/templates">
            Edit my message
          </a>
          {me.can_rename && (
            <a className="btn ghost small" href="/name">
              Switch profile
            </a>
          )}
          <button className="btn ghost small" type="button" onClick={logout}>
            Log out{me.user ? ` (${me.user})` : ""}
          </button>
        </>
      )}
    </>
  );
}
