"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, Template, Templates, api, getSession } from "@/lib/api";

type Flash = { text: string; bad: boolean };

function blankList(d: Templates | null): string {
  const own = d?.templates.flatMap((t) => t.blanks || []) || [];
  return own.length ? own.join(" and ") : "[Twitter Name] or [Instagram Name]";
}

export default function TemplatesPage() {
  const router = useRouter();
  const [data, setData] = useState<Templates | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<Flash | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }
    api<Templates>("/templates")
      .then((d) => {
        setData(d);
        setDrafts(Object.fromEntries(d.templates.map((t) => [t.platform, t.text])));
      })
      .catch((e: ApiError) => setFlash({ text: e.message, bad: true }));
  }, [router]);

  function update(t: Template) {
    setData((d) => d && { ...d, templates: d.templates.map((x) => (x.platform === t.platform ? t : x)) });
    setDrafts((d) => ({ ...d, [t.platform]: t.text }));
  }

  async function save(t: Template) {
    setBusy(true);
    setFlash(null);
    try {
      const r = await api<Template & { updated_waiting: number }>(`/templates/${t.platform}`, {
        method: "PUT",
        body: { text: drafts[t.platform] },
      });
      update(r);
      setFlash({
        text: r.updated_waiting
          ? `Saved. ${r.updated_waiting} waiting DMs now use the new message.`
          : "Saved. New DMs will use this message.",
        bad: false,
      });
    } catch (e) {
      setFlash({ text: (e as ApiError).message, bad: true });
    }
    setBusy(false);
    window.scrollTo(0, 0);
  }

  async function reset(t: Template) {
    setBusy(true);
    setFlash(null);
    try {
      const r = await api<Template>(`/templates/${t.platform}/reset`, { method: "POST" });
      update(r);
      setFlash({ text: "Back to the original message.", bad: false });
    } catch (e) {
      setFlash({ text: (e as ApiError).message, bad: true });
    }
    setBusy(false);
    window.scrollTo(0, 0);
  }

  return (
    <>
      <h1>
        Your <em>message.</em>
      </h1>
      <p className="muted">
        This is the DM that goes out for your account. Type {blankList(data)} where their name should go. It is filled in with
        their display name for each contact; [Name] (first name) and [Club Name] (company) also work. Saved changes are used for
        every DM from now on, including the ones already waiting in your queue.
      </p>
      {flash && (
        <div className={flash.bad ? "flash err" : "flash"} role="status">
          {flash.text}
        </div>
      )}
      {data?.templates.map((t) => {
        const draft = drafts[t.platform] ?? "";
        const changed = draft.trim() !== t.text.trim();
        return (
          <div className="card" key={t.platform}>
            <div className="meta">
              <span className="badge">{t.label}</span>
              {t.customized && <span className="chip">edited</span>}
            </div>
            <textarea
              className="msg"
              value={draft}
              onChange={(e) => setDrafts((d) => ({ ...d, [t.platform]: e.target.value }))}
              aria-label={`${t.label} message`}
              maxLength={5000}
              rows={14}
            />
            <button className="btn primary" type="button" disabled={busy || !changed || !draft.trim()} onClick={() => save(t)}>
              Save message
            </button>
            {t.customized && (
              <button className="btn ghost small" type="button" disabled={busy} onClick={() => reset(t)}>
                Go back to the original
              </button>
            )}
          </div>
        );
      })}
      <a className="btn ghost small" href="/">
        Back to the queue
      </a>
    </>
  );
}
