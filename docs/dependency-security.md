# 依存関係の監査メモ

確認日：2026-10-19。元プロジェクトから依存バージョンを引き継ぎ、今回のポートフォリオ準備では更新していません。

`npm audit --json`はHigh 5件、`npm audit --omit=dev --json`は0件でした。5件は独立した5つの攻撃ではなく、以下の開発依存の連鎖に由来します。

`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`

対象はlint等の開発ツールで、細工された深いbraceパターンを処理するとスタック枯渇によるDoSを起こし得ます。詳細は[GitHub Advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)を参照してください。調査時点で修正版の表示はありません。

対処方針は上流の修正・互換性を確認した更新の追跡です。`npm audit fix --force`が提示するNext 14系のeslint-configへの変更は、このNext 16系構成に無検証では適用しません。CIは読み取り専用・秘密値なし・制限時間付きとし、不審なPRの実行には注意してください。公開前に残件を承認するか、解消後に再監査するかを所有者が判断してください。

0件という結果は既知の登録済み脆弱性の検出数であり、未知の脆弱性が存在しないという保証ではありません。
