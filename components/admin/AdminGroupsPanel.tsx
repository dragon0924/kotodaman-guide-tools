"use client";

import { ArrowDown, ArrowUp, RotateCcw, Save, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GroupOrderEntry, GroupOrderFile } from "@/lib/groupOrder";

type GroupAdminResponse = {
  path: string;
  order: GroupOrderFile;
  merged: GroupOrderFile;
  detected: {
    groups: string[];
    collabGroups: string[];
  };
  missing: {
    groups: string[];
    collabGroups: string[];
  };
  orphaned?: {
    groups: string[];
    collabGroups: string[];
  };
};

function emptyOrder(): GroupOrderFile {
  return {
    groups: [],
    collabGroups: [],
  };
}

async function requestAdmin(url: string, secret: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-admin-password": secret,
      ...(init.headers ?? {}),
    },
  });
}

function normalizeOrder(entries: GroupOrderEntry[]) {
  return entries.map((entry, index) => ({
    ...entry,
    name: entry.name.trim(),
    displayName: entry.displayName?.trim() || undefined,
    firstHeldAt: entry.firstHeldAt?.trim() || undefined,
    order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : (index + 1) * 10,
  }));
}

function moveEntry(entries: GroupOrderEntry[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= entries.length) {
    return entries;
  }
  const next = [...entries];
  const current = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = current;
  return normalizeOrder(next);
}

function GroupList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="admin-group-diagnostic-card">
      <strong>{title}</strong>
      {items.length ? (
        <div className="character-tags">
          {items.map((item) => (
            <span className="tag muted-tag" key={item}>{item}</span>
          ))}
        </div>
      ) : (
        <p className="muted">なし</p>
      )}
    </div>
  );
}

function GroupOrderTable({
  entries,
  kind,
  onChange,
}: {
  entries: GroupOrderEntry[];
  kind: keyof GroupOrderFile;
  onChange: (entries: GroupOrderEntry[]) => void;
}) {
  function update(index: number, patch: Partial<GroupOrderEntry>) {
    onChange(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)));
  }

  return (
    <div className="admin-group-table">
      <div className="admin-group-table-head">
        <span>順</span>
        <span>グループ名</span>
        <span>表示名</span>
        <span>{kind === "collabGroups" ? "初回開催日" : "初回開催日"}</span>
        <span>order</span>
        <span>並び替え</span>
      </div>
      {entries.length ? (
        entries.map((entry, index) => (
          <div className="admin-group-row" key={`${kind}-${entry.name}-${index}`}>
            <span className="muted">{index + 1}</span>
            <input value={entry.name} readOnly aria-label="内部キー" title="キャラデータと照合する内部キーです" />
            <input
              value={entry.displayName ?? ""}
              onChange={(event) => update(index, { displayName: event.target.value || undefined })}
              aria-label={`${entry.name} の表示名`}
              placeholder={entry.name}
            />
            <input
              type="date"
              value={entry.firstHeldAt ?? ""}
              onChange={(event) => update(index, { firstHeldAt: event.target.value || undefined })}
              aria-label="初回開催日"
            />
            <input
              type="number"
              value={entry.order ?? ""}
              onChange={(event) => update(index, { order: event.target.value ? Number(event.target.value) : undefined })}
              aria-label="表示順"
            />
            <div className="admin-row-actions">
              <button
                disabled={index === 0}
                onClick={() => onChange(moveEntry(entries, index, -1))}
                type="button"
                aria-label={`${entry.name}を上へ`}
              >
                <ArrowUp size={15} aria-hidden />
              </button>
              <button
                disabled={index === entries.length - 1}
                onClick={() => onChange(moveEntry(entries, index, 1))}
                type="button"
                aria-label={`${entry.name}を下へ`}
              >
                <ArrowDown size={15} aria-hidden />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="muted">まだ登録されていません。未登録グループを追加してください。</p>
      )}
    </div>
  );
}

export function AdminGroupsPanel({ adminPassword }: { adminPassword: string }) {
  const [order, setOrder] = useState<GroupOrderFile>(() => emptyOrder());
  const [mergedOrder, setMergedOrder] = useState<GroupOrderFile>(() => emptyOrder());
  const [detected, setDetected] = useState<{ groups: string[]; collabGroups: string[] }>(() => ({
    groups: [],
    collabGroups: [],
  }));
  const [missing, setMissing] = useState<{ groups: string[]; collabGroups: string[] }>(() => ({
    groups: [],
    collabGroups: [],
  }));
  const [orphaned, setOrphaned] = useState<{ groups: string[]; collabGroups: string[] }>(() => ({
    groups: [],
    collabGroups: [],
  }));
  const [path, setPath] = useState("data/groupOrder.json");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const totalMissing = useMemo(
    () => missing.groups.length + missing.collabGroups.length,
    [missing.collabGroups.length, missing.groups.length],
  );

  const loadGroups = useCallback(async (secret: string) => {
    setError("");
    setStatus("");
    const response = await requestAdmin("/api/admin/groups", secret);
    if (!response.ok) {
      setError(response.status === 401 ? "認証に失敗しました。.env.local の ADMIN_PASSWORD を確認してください。" : await response.text());
      return;
    }
    const data = (await response.json()) as GroupAdminResponse;
    setPath(data.path);
    setOrder(data.order);
    setMergedOrder(data.merged);
    setDetected(data.detected);
    setMissing(data.missing);
    setOrphaned(data.orphaned ?? { groups: [], collabGroups: [] });
    setStatus(`読み込み完了: オリジナル${data.order.groups.length}件 / コラボ${data.order.collabGroups.length}件`);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGroups(adminPassword);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [adminPassword, loadGroups]);

  async function save() {
    setError("");
    setStatus("保存中...");
    const payload: GroupOrderFile = {
      groups: normalizeOrder(order.groups),
      collabGroups: normalizeOrder(order.collabGroups),
    };
    const response = await requestAdmin("/api/admin/groups", adminPassword, {
      body: JSON.stringify(payload),
      method: "PUT",
    });
    if (!response.ok) {
      setError(await response.text());
      setStatus("");
      return;
    }
    await fetch("/api/characters/meta?refresh=1", { cache: "no-store" });
    await fetch("/api/characters/search?refresh=1&limit=1", { cache: "no-store" });
    setStatus(`保存しました: ${path}`);
    await loadGroups(adminPassword);
  }

  function addMissingGroups() {
    setOrder(mergedOrder);
    setStatus(`未登録グループを追加しました。保存すると ${path} に反映されます。`);
  }

  return (
    <section className="admin-group-manager">
      <div className="section-heading">
        <div>
          <h1>グループ表示管理</h1>
          <p className="muted">
            グループ名はキャラデータと照合する内部キーです。名前は変更せず、画面上の表記だけ変えたい場合は表示名を編集してください。
          </p>
        </div>
        <span className="tag muted-tag">{path}</span>
      </div>

      <div className="actions admin-group-actions">
        <button className="primary" onClick={save} type="button">
          <Save size={16} aria-hidden />
          保存
        </button>
        <button onClick={() => void loadGroups(adminPassword)} type="button">
          <RotateCcw size={16} aria-hidden />
          リセット
        </button>
        <button disabled={totalMissing === 0} onClick={addMissingGroups} type="button">
          <Search size={16} aria-hidden />
          未登録グループを追加 ({totalMissing})
        </button>
      </div>

      {status ? <p className="status">{status}</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      <div className="admin-group-diagnostics">
        <GroupList title="検出済みオリジナル" items={detected.groups} />
        <GroupList title="検出済みコラボ" items={detected.collabGroups} />
        <GroupList title="未登録オリジナル" items={missing.groups} />
        <GroupList title="未登録コラボ" items={missing.collabGroups} />
        <GroupList title="孤立オリジナル" items={orphaned.groups} />
        <GroupList title="孤立コラボ" items={orphaned.collabGroups} />
      </div>

      <div className="admin-group-layout">
        <section className="admin-edit-card">
          <h2>オリジナルグループ</h2>
          <p className="muted">order順で表示します。表示名は検索値ではなく画面表示だけに使われます。</p>
          <GroupOrderTable
            entries={order.groups}
            kind="groups"
            onChange={(entries) => setOrder((current) => ({ ...current, groups: entries }))}
          />
        </section>
        <section className="admin-edit-card">
          <h2>コラボグループ</h2>
          <p className="muted">firstHeldAt 昇順、同日/未設定は order、最後に名前順で表示します。</p>
          <GroupOrderTable
            entries={order.collabGroups}
            kind="collabGroups"
            onChange={(entries) => setOrder((current) => ({ ...current, collabGroups: entries }))}
          />
        </section>
      </div>
    </section>
  );
}
