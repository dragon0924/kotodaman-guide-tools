"use client";

import { CheckSquare, RotateCcw, Square, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SpecialRarityBadge } from "@/components/SpecialRarityBadge";
import type { SpecialRarityCandidate } from "@/lib/types";

type CandidateResponse = {
  path: string;
  total: number;
  candidates: SpecialRarityCandidate[];
};

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

export function AdminSpecialRarityPanel({ adminPassword }: { adminPassword: string }) {
  const [path, setPath] = useState("data/specialRarityCandidates.json");
  const [candidates, setCandidates] = useState<SpecialRarityCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const pendingCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.status !== "applied" && candidate.status !== "excluded"),
    [candidates],
  );

  const loadCandidates = useCallback(async () => {
    setError("");
    setStatus("");
    const response = await requestAdmin("/api/admin/special-rarity-candidates", adminPassword);
    if (!response.ok) {
      setError(response.status === 401 ? "認証に失敗しました。ADMIN_PASSWORD を確認してください。" : await response.text());
      return;
    }
    const data = (await response.json()) as CandidateResponse;
    setPath(data.path);
    setCandidates(data.candidates ?? []);
    setSelectedIds([]);
    setStatus(`読み込み完了: ${data.total.toLocaleString()}件`);
  }, [adminPassword]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCandidates();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCandidates]);

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function applyCandidates(exclude = false) {
    setError("");
    setStatus(exclude ? "除外中..." : "適用中...");
    const response = await requestAdmin("/api/admin/special-rarity-candidates", adminPassword, {
      method: "PUT",
      body: JSON.stringify(exclude ? { excludeIds: selectedIds } : { characterIds: selectedIds }),
    });
    if (!response.ok) {
      setStatus("");
      setError(await response.text());
      return;
    }
    const data = (await response.json()) as {
      candidates: SpecialRarityCandidate[];
      applied: number;
      excluded: number;
      conflicts?: Array<{
        name: string;
        currentRarityType: string;
        candidateRarityTypes: string[];
      }>;
    };
    setCandidates(data.candidates ?? []);
    setSelectedIds([]);
    await fetch("/api/characters/meta?refresh=1", { cache: "no-store" });
    const conflictCount = data.conflicts?.length ?? 0;
    setStatus(
      exclude
        ? `除外しました: ${data.excluded.toLocaleString()}件`
        : `適用しました: ${data.applied.toLocaleString()}件${conflictCount ? `／競合: ${conflictCount.toLocaleString()}件` : ""}`,
    );
    if (conflictCount) {
      setError(
        `既存値と競合したため未適用: ${data.conflicts
          ?.map((conflict) => `${conflict.name}（現在: ${conflict.currentRarityType || "未登録"}／候補: ${conflict.candidateRarityTypes.join("・") || "複数"}）`)
          .join("、")}`,
      );
    }
  }

  return (
    <section className="admin-special-rarity-manager">
      <div className="section-heading">
        <div>
          <h1>特殊レアリティ候補確認</h1>
          <p className="muted">
            外部ページから抽出した特殊レアリティ候補を確認して、characters.manual.json に適用します。
          </p>
        </div>
        <span className="tag muted-tag">{path}</span>
      </div>

      <div className="actions admin-group-actions">
        <button onClick={() => void loadCandidates()} type="button">
          <RotateCcw size={16} aria-hidden />
          再読み込み
        </button>
        <button onClick={() => setSelectedIds(pendingCandidates.map((candidate) => candidate.characterId))} type="button">
          <CheckSquare size={16} aria-hidden />
          全選択
        </button>
        <button onClick={() => setSelectedIds([])} type="button">
          <Square size={16} aria-hidden />
          全解除
        </button>
        <button className="primary" disabled={!selectedIds.length} onClick={() => void applyCandidates(false)} type="button">
          選択候補を適用
        </button>
        <button disabled={!selectedIds.length} onClick={() => void applyCandidates(true)} type="button">
          <XCircle size={16} aria-hidden />
          選択候補を除外
        </button>
      </div>

      {status ? <p className="status">{status}</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      <div className="special-rarity-summary">
        <span>候補: {candidates.length.toLocaleString()}件</span>
        <span>未処理: {pendingCandidates.length.toLocaleString()}件</span>
        <span>選択中: {selectedIds.length.toLocaleString()}件</span>
      </div>

      <div className="special-rarity-candidate-list">
        {candidates.length ? (
          candidates.map((candidate) => {
            const checked = selectedIds.includes(candidate.characterId);
            return (
              <article
                className={`special-rarity-candidate ${candidate.status ?? "pending"}`}
                key={`${candidate.characterId}-${candidate.candidateRarityType}-${candidate.matchedSourceUrl}`}
              >
                <label className="toggle-row">
                  <input
                    checked={checked}
                    disabled={candidate.status === "applied" || candidate.status === "excluded"}
                    type="checkbox"
                    onChange={() => toggle(candidate.characterId)}
                  />
                  <strong>{candidate.name}</strong>
                </label>
                <div className="character-tags">
                  <span className="tag muted-tag">現在: {candidate.currentRarityType || "未登録"}</span>
                  <SpecialRarityBadge compact rarity={candidate.candidateRarityType} />
                  <span className="tag muted-tag">抽出元: {candidate.matchedSectionTitle || "未記録"}</span>
                  <span className={`tag ${candidate.confidence === "high" ? "success-tag" : "warning-tag"}`}>
                    {candidate.confidence}
                  </span>
                  {candidate.status ? <span className="tag muted-tag">{candidate.status}</span> : null}
                </div>
                <a href={candidate.matchedSourceUrl} rel="noreferrer" target="_blank">
                  {candidate.sourceMemo || candidate.matchedSourceUrl}
                </a>
                <pre>{candidate.matchedText}</pre>
              </article>
            );
          })
        ) : (
          <p className="muted">
            候補がありません。`data/specialRaritySourceUrls.json` にURLを追加して `npm run import:special-rarity-candidates` を実行してください。
          </p>
        )}
      </div>
    </section>
  );
}
