# 第三者ライブラリと権利の範囲

このソースはnpmライブラリを参照します。`node_modules`のコピーや依存ライブラリのソース本体はリポジトリへ含めません。依存ライブラリはそれぞれのライセンスに従ってインストール・利用してください。

主なライブラリはNext.js・React・Tiptap・PostCSS・ESLint（MIT）、Lucide React（ISC）、Sharp・TypeScript・Playwright（Apache-2.0）です。バージョンと実際のpackage metadataは[dependency-licenses.json](docs/dependency-licenses.json)に記録しています。

lockfileの推移的・任意依存を含む460エントリは[dependency-licenses-transitive.json](docs/dependency-licenses-transitive.json)に記録しています。MIT等に加えて、Sharpのプラットフォーム別バイナリ／libvipsにLGPL-3.0-or-later、axe-coreにMPL-2.0、caniuse-liteにCC-BY-4.0の表示があります。これはlockfileの申告値を調べた一覧で、全依存を独立に法的審査したものではありません。

依存物やstandaloneのバイナリを将来配布する際は、対象プラットフォームに実際に同梱する依存のLICENSE・NOTICE・帰属表示、適用されるソース提供等の条件を確認して保持してください。Sharp自体のApache-2.0だけでlibvips等の条件まで置き換わることはありません。[Sharpのインストール・ライセンス説明](https://sharp.pixelplumbing.com/install/#licensing)

当プロジェクト固有コードのライセンスが今後決定されても、第三者ライブラリの権利を置き換えることはありません。実ゲーム素材や取得済み攻略データは含めていません。
