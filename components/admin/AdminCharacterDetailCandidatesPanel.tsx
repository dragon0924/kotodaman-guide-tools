"use client";

import { CheckSquare, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CharacterDetailCandidate } from "@/lib/types";

type DetailField =
  | "leaderTraitText"
  | "normalMove"
  | "superMove"
  | "traitsRaw"
  | "blessingTraitsRaw"
  | "status"
  | "exSkill"
  | "chargeSkill"
  | "missingLetters";

type CandidateResponse = {
  path: string;
  total: number;
  candidates: CharacterDetailCandidate[];
};

const FIELD_LABELS: Array<{ key: DetailField; label: string }> = [
  { key: "leaderTraitText", label: "リーダー特性全文" },
  { key: "normalMove", label: "わざ" },
  { key: "superMove", label: "すごわざ" },
  { key: "traitsRaw", label: "とくせい生テキスト" },
  { key: "blessingTraitsRaw", label: "祝福特性生テキスト" },
  { key: "status", label: "ステータス" },
  { key: "exSkill", label: "EXスキル" },
  { key: "chargeSkill", label: "チャージスキル" },
  { key: "missingLetters", label: "不足持ち文字" },
];

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

function hasText(value?: string) {
  return Boolean(value?.trim());
}

function hasField(candidate: CharacterDetailCandidate, field: DetailField) {
  if (field === "leaderTraitText") return hasText(candidate.leaderTraitText);
  if (field === "normalMove") return hasText(candidate.normalMove?.condition) || hasText(candidate.normalMove?.effect);
  if (field === "superMove") return hasText(candidate.superMove?.condition) || hasText(candidate.superMove?.effect);
  if (field === "traitsRaw") return Boolean(candidate.traitsRaw?.length);
  if (field === "blessingTraitsRaw") return Boolean(candidate.blessingTraitsRaw?.length);
  if (field === "status") return Boolean(candidate.status?.raw?.length || candidate.status?.hp || candidate.status?.atk || candidate.status?.maxHp || candidate.status?.maxAtk || candidate.status?.blessedHp || candidate.status?.blessedAtk);
  if (field === "exSkill") return hasText(candidate.exSkill?.name) || hasText(candidate.exSkill?.summary) || hasText(candidate.exSkill?.effect);
  if (field === "chargeSkill") return hasText(candidate.chargeSkill?.name) || hasText(candidate.chargeSkill?.summary) || hasText(candidate.chargeSkill?.effect);
  if (field === "missingLetters") return Boolean(getMissingLetterCandidates(candidate).length);
  return false;
}

function defaultFields(candidate: CharacterDetailCandidate): DetailField[] {
  return FIELD_LABELS.map((field) => field.key).filter((field) => hasField(candidate, field));
}

function getMissingLetterCandidates(candidate: CharacterDetailCandidate) {
  if (candidate.missingVoicedLetters?.length) {
    return Array.from(new Set(candidate.missingVoicedLetters.map((letter) => letter.trim()).filter(Boolean)));
  }
  const current = new Set(candidate.currentLetters ?? []);
  const values = [
    ...(candidate.extractedLetters ?? []).filter((letter) => !current.has(letter)),
    ...(candidate.extractedLetterAttributes ?? []).map((item) => item.letter).filter((letter) => !current.has(letter)),
  ];
  return Array.from(new Set(values.map((letter) => letter.trim()).filter(Boolean)));
}

function FieldPreview({ candidate, field }: { candidate: CharacterDetailCandidate; field: DetailField }) {
  if (field === "leaderTraitText") {
    return <pre>{candidate.leaderTraitText}</pre>;
  }
  if (field === "normalMove") {
    return <pre>{[`条件: ${candidate.normalMove?.condition ?? ""}`, `効果: ${candidate.normalMove?.effect ?? ""}`].join("\n")}</pre>;
  }
  if (field === "superMove") {
    return <pre>{[`条件: ${candidate.superMove?.condition ?? ""}`, `効果: ${candidate.superMove?.effect ?? ""}`].join("\n")}</pre>;
  }
  if (field === "traitsRaw") {
    return <pre>{candidate.traitsRaw?.join("\n")}</pre>;
  }
  if (field === "blessingTraitsRaw") {
    return <pre>{candidate.blessingTraitsRaw?.join("\n")}</pre>;
  }
  if (field === "status") {
    return (
      <pre>
        {[
          `HP: ${candidate.status?.hp ?? ""}`,
          `ATK: ${candidate.status?.atk ?? ""}`,
          `最大HP: ${candidate.status?.maxHp ?? ""}`,
          `最大ATK: ${candidate.status?.maxAtk ?? ""}`,
          `祝福HP: ${candidate.status?.blessedHp ?? ""}`,
          `祝福ATK: ${candidate.status?.blessedAtk ?? ""}`,
          "",
          ...(candidate.status?.raw ?? []),
        ].join("\n")}
      </pre>
    );
  }
  if (field === "exSkill") {
    return <pre>{[`名前: ${candidate.exSkill?.name ?? ""}`, `概要: ${candidate.exSkill?.summary ?? ""}`, `効果: ${candidate.exSkill?.effect ?? ""}`].join("\n")}</pre>;
  }
  if (field === "chargeSkill") {
    return <pre>{[`名前: ${candidate.chargeSkill?.name ?? ""}`, `概要: ${candidate.chargeSkill?.summary ?? ""}`, `効果: ${candidate.chargeSkill?.effect ?? ""}`].join("\n")}</pre>;
  }
  if (field === "missingLetters") {
    return (
      <div className="detail-letter-audit-preview">
        <p><strong>追加候補:</strong> {getMissingLetterCandidates(candidate).join(" / ") || "なし"}</p>
        <p><strong>currentLetters:</strong> {(candidate.currentLetters ?? []).join(" / ") || "なし"}</p>
        <p><strong>extractedLetters:</strong> {(candidate.extractedLetters ?? []).join(" / ") || "なし"}</p>
        <p><strong>missingVoicedLetters:</strong> {(candidate.missingVoicedLetters ?? []).join(" / ") || "なし"}</p>
        <p><strong>letterWarnings:</strong> {(candidate.letterWarnings ?? []).join(" / ") || "なし"}</p>
        <pre>{JSON.stringify({
          currentLetterAttributes: candidate.currentLetterAttributes ?? [],
          extractedLetterAttributes: candidate.extractedLetterAttributes ?? [],
        }, null, 2)}</pre>
      </div>
    );
  }
  return null;
}

export function AdminCharacterDetailCandidatesPanel({ adminPassword }: { adminPassword: string }) {
  const [path, setPath] = useState("data/characterDetailCandidates.json");
  const [candidates, setCandidates] = useState<CharacterDetailCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fieldsById, setFieldsById] = useState<Record<string, DetailField[]>>({});
  const [lettersById, setLettersById] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const candidatesWithFields = useMemo(
    () => candidates.filter((candidate) => defaultFields(candidate).length),
    [candidates],
  );

  const loadCandidates = useCallback(async () => {
    setError("");
    setStatus("");
    const response = await requestAdmin("/api/admin/character-detail-candidates", adminPassword);
    if (!response.ok) {
      setError(response.status === 401 ? "認証に失敗しました。ADMIN_PASSWORD を確認してください。" : await response.text());
      return;
    }
    const data = (await response.json()) as CandidateResponse;
    const nextFields = Object.fromEntries(
      (data.candidates ?? []).map((candidate) => [candidate.characterId, defaultFields(candidate)]),
    );
    const nextLetters = Object.fromEntries(
      (data.candidates ?? []).map((candidate) => [candidate.characterId, getMissingLetterCandidates(candidate)]),
    );
    setPath(data.path);
    setCandidates(data.candidates ?? []);
    setFieldsById(nextFields);
    setLettersById(nextLetters);
    setSelectedIds([]);
    setStatus(`読み込み完了: ${data.total.toLocaleString()}件`);
  }, [adminPassword]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCandidates();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCandidates]);

  function toggleCandidate(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleField(id: string, field: DetailField) {
    setFieldsById((current) => {
      const fields = current[id] ?? [];
      return {
        ...current,
        [id]: fields.includes(field) ? fields.filter((item) => item !== field) : [...fields, field],
      };
    });
  }

  function toggleLetter(id: string, letter: string) {
    setLettersById((current) => {
      const letters = current[id] ?? [];
      return {
        ...current,
        [id]: letters.includes(letter) ? letters.filter((item) => item !== letter) : [...letters, letter],
      };
    });
  }

  async function applySelected() {
    setError("");
    setStatus("適用中...");
    const response = await requestAdmin("/api/admin/character-detail-candidates", adminPassword, {
      method: "PUT",
      body: JSON.stringify({
        characterIds: selectedIds,
        fieldsByCharacterId: Object.fromEntries(selectedIds.map((id) => [id, fieldsById[id] ?? []])),
        lettersByCharacterId: Object.fromEntries(selectedIds.map((id) => [id, lettersById[id] ?? []])),
      }),
    });
    if (!response.ok) {
      setStatus("");
      setError(await response.text());
      return;
    }
    const data = (await response.json()) as { applied: number };
    setSelectedIds([]);
    await fetch("/api/characters/meta?refresh=1", { cache: "no-store" });
    await loadCandidates();
    setStatus(`適用しました: ${data.applied.toLocaleString()}件`);
  }

  return (
    <section className="admin-special-rarity-manager">
      <div className="section-heading">
        <div>
          <h1>詳細情報候補確認</h1>
          <p className="muted">
            `data/characterDetailCandidates.json` の候補を確認し、選択した項目だけ characters.manual.json に適用します。
          </p>
        </div>
        <span className="tag muted-tag">{path}</span>
      </div>

      <div className="actions admin-group-actions">
        <button onClick={() => void loadCandidates()} type="button">
          <RotateCcw size={16} aria-hidden />
          再読み込み
        </button>
        <button onClick={() => setSelectedIds(candidatesWithFields.map((candidate) => candidate.characterId))} type="button">
          <CheckSquare size={16} aria-hidden />
          全選択
        </button>
        <button onClick={() => setSelectedIds([])} type="button">
          <Square size={16} aria-hidden />
          全解除
        </button>
        <button className="primary" disabled={!selectedIds.length} onClick={() => void applySelected()} type="button">
          選択候補を適用
        </button>
      </div>

      {status ? <p className="status">{status}</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      <div className="special-rarity-summary">
        <span>候補: {candidates.length.toLocaleString()}件</span>
        <span>適用可能: {candidatesWithFields.length.toLocaleString()}件</span>
        <span>選択中: {selectedIds.length.toLocaleString()}件</span>
      </div>

      <div className="special-rarity-candidate-list">
        {candidates.length ? (
          candidates.map((candidate) => {
            const selected = selectedIds.includes(candidate.characterId);
            const availableFields = FIELD_LABELS.filter((field) => hasField(candidate, field.key));
            return (
              <article className="special-rarity-candidate" key={`${candidate.characterId}-${candidate.extractedAt}`}>
                <label className="toggle-row">
                  <input checked={selected} onChange={() => toggleCandidate(candidate.characterId)} type="checkbox" />
                  <strong>{candidate.name}</strong>
                </label>
                <div className="character-tags">
                  <span className="tag muted-tag">{candidate.extractedAt}</span>
                  {candidate.sourceUrl ? (
                    <a href={candidate.sourceUrl} rel="noreferrer" target="_blank">
                      sourceUrl
                    </a>
                  ) : null}
                </div>
                {availableFields.length ? (
                  <div className="detail-candidate-fields">
                    {availableFields.map((field) => (
                      <details key={`${candidate.characterId}-${field.key}`} open={selected}>
                        <summary>
                          <label className="toggle-row">
                            <input
                              checked={(fieldsById[candidate.characterId] ?? []).includes(field.key)}
                              onChange={() => toggleField(candidate.characterId, field.key)}
                              type="checkbox"
                            />
                            <span>{field.label}</span>
                          </label>
                        </summary>
                        {field.key === "missingLetters" ? (
                          <div className="letter-candidate-toggle-list">
                            {getMissingLetterCandidates(candidate).map((letter) => (
                              <label className="toggle-row" key={`${candidate.characterId}-${letter}`}>
                                <input
                                  checked={(lettersById[candidate.characterId] ?? []).includes(letter)}
                                  onChange={() => toggleLetter(candidate.characterId, letter)}
                                  type="checkbox"
                                />
                                <span>{letter}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                        <FieldPreview candidate={candidate} field={field.key} />
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="muted">適用できる詳細候補がありません。</p>
                )}
              </article>
            );
          })
        ) : (
          <p className="muted">候補がありません。`npm run import:characters` の限定実行などで候補ファイルを作成してください。</p>
        )}
      </div>
    </section>
  );
}
