# プロフィールREADMEのOSSカード 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CIで毎日Honoミドルウェア5つのカードSVGを作ってコミットし、READMEのdevcardの画像とOSSの表を置き換える。

**Architecture:** 実行時の依存パッケージを持たないNodeのスクリプトです。コードはTypeScriptで、Node 26の型除去（type stripping）でそのまま実行します。型チェック、lint、フォーマットのために、typescript・@types/node・oxlint・oxfmtだけを開発用に入れます。手順は3段に分けます。

1. npmとGitHubのAPIから全データを取得する
2. カードの文字列を組み立てる
3. 全部そろってからファイルに書き出す

取得が1つでも失敗したら何も書かずに終了コード1で止まります。GitHub Actionsは、`assets/`に差分があるときだけコミットします。

**Tech Stack:** Node 26（ローカルと同じ）、TypeScript（ESM、型除去で実行）、パッケージマネージャーはpnpm、テストは`node:test`、GitHub Actions（`actions/checkout` v7.0.1、`pnpm/action-setup` v6.1.1、`actions/setup-node` v7.1.0をSHAで固定）

**Spec:** `docs/superpowers/specs/2026-11-18-readme-svg-design.md`

## Global Constraints
- 実行時の依存パッケージは持たない（`package.json`に`dependencies`は書かない）。開発用に入れるのは、型チェックのtypescriptと@types/node、lintのoxlint、フォーマットのoxfmtだけ（`devDependencies`）
- 色はme.funailog.comと同じ値を使う
  - ライト：paper `#FBFCFD`、ink `#1C2733`、muted `#5B6B7C`、rule `#DCE2E9`、span `#2E6BD6`、open `#B07200`
  - ダーク：paper `#14212F`、ink `#E6ECF2`、muted `#9AABBD`、rule `#2A3B4F`、span `#6FA0F2`、open `#F2B544`
- 言語の色は`{ TypeScript: '#3178C6' }`。表にない言語は点を描かない
- 書体は`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`。外部のフォントは読み込まない
- アニメーションは一度だけ再生し、終わったら完成した状態で止める（`forwards`か`both`）。`@media (prefers-reduced-motion: reduce)`では、最初から完成した状態にする
- 星はOcticonsの`star-fill-16`のパスを使い、色は`open`にする。位置は外側の`<g transform>`で決め、アニメーションは中の`<path>`にだけかける（CSSの`transform`が`transform`属性を上書きするため）
- 見た目は、サンプル`/private/tmp/claude-501/-Users-ryota-repos-github-com-paveg-portfolio/50d61ac0-9a33-4606-81a1-2195ccc15652/scratchpad/readme-sample/generate.mjs`の`packageSvg`に合わせる。カードは420×164
- push、PRの作成、mainへのマージは、ユーザーに確認してから行う

## Review Focus
- npmのAPIが404やエラーを返す（未公開、名前の誤り）→ 例外を投げ、`assets/`のファイルを1つも書き換えない
- 30日間のダウンロード数がすべて0 → 折れ線の座標に`NaN`が出ず、平らな線になる
- 説明文に`&`や`<`が入る → エスケープされ、XMLとして壊れない
- GitHubの`language`か`license`が`null` → その項目を描かずに、カードは作れる
- スター数が1,000以上 → `1.2k`のように短く表示し、星のアイコンが数字に重ならない

---

## ファイル構成
```
config/packages.json          パッケージ名と英語の説明（手で持つデータ）
scripts/lib/svg.ts           THEMES・FONT・escapeXml・compactNumber
scripts/lib/package-card.ts  renderPackageCard（純粋関数）
scripts/lib/fetch-data.ts    loadPackages・fetchDownloads・fetchRepoMeta
scripts/generate.ts          エントリーポイント（取得→組み立て→書き出し）
tests/*.test.ts              node:test
.github/workflows/update-svgs.yml
assets/oss/<name>-{light,dark}.svg   生成物（コミットする）
package.json                  name・private・"type": "module"、packageManager（pnpm）、engines、scripts 7本
```

### Task 1: 共通の部品とカードの組み立て

**Files:**
- Create: `package.json`, `scripts/lib/svg.ts`, `scripts/lib/package-card.ts`
- Test: `tests/svg.test.ts`, `tests/package-card.test.ts`

**Interfaces:**
- Produces:
  - `THEMES: { light: Palette, dark: Palette }`
  - `FONT: string`
  - `escapeXml(text: string): string`
  - `compactNumber(value: number): string`
  - `renderPackageCard(card: PackageCard, theme: 'light' | 'dark'): string`
  - `PackageCard = { name: string, description: string, stars: number, language: string | null, license: string | null, downloads: number[] }`

- [ ] **Step 1: テストを書く**
  - `tests/svg.test.ts`
    - `compactNumber`：`999→'999'`、`1000→'1.0k'`、`7312→'7.3k'`、`73012→'73k'`
    - `escapeXml('a & <b>')`が`'a &amp; &lt;b&gt;'`になる
  - `tests/package-card.test.ts`
    - サンプルの`hono-idempotency`（stars 14、TypeScript、MIT）で、出力に`>hono-idempotency<`、`>14<`、`>TypeScript<`、`>MIT<`、`downloads / 30 days`、`#3178C6`が含まれる
    - `<title`の中身に、合計ダウンロード数（数字）が入る
    - ダウンロードがすべて0の30日分で、出力に`NaN`も`Infinity`も含まれない
    - 説明文が`'Fast & <safe>'`のとき、`Fast &amp; &lt;safe&gt;`が含まれ、`<safe>`は含まれない
    - `language: null`と`license: null`のとき、`<circle`も`null`という文字列も含まれない
    - `stars: 1234`のとき`>1.2k<`が含まれる。星の`<g transform="translate(X `のXが、`420 - 20 - 文字数×8.5 - 21`（4文字）以下になる
    - `light`と`dark`で、背景の`#FBFCFD`と`#14212F`がそれぞれ入る
- [ ] **Step 2: 失敗を確かめる** Run: `pnpm run test` Expected: 未定義のimportで失敗
- [ ] **Step 3: 実装する**
  - `package.json`は`name: "paveg-profile"`、`private: true`（誤ってpublishしないため）、`type: module`、`packageManager`（pnpm）、`engines`（Node 26以上）、スクリプト（`typecheck`、`lint`、`fmt`、`fmt:check`、`test`、`generate`、`check`）を持つ形にする。`check`は`typecheck`→`lint`→`fmt:check`→`test`の順に実行する
  - カードの組み立ては、サンプルの`packageSvg`を移植する。折れ線の縦の幅は、`Math.max(...downloads, 1)`で割る
- [ ] **Step 4: 通ることを確かめる** Run: `pnpm run test` Expected: すべてpass、終了コード0
- [ ] **Step 5: コミット** `git commit -m "feat: OSSカードのSVGを組み立てる"`

### Task 2: データの取得

**Files:**
- Create: `config/packages.json`, `scripts/lib/fetch-data.ts`
- Test: `tests/fetch-data.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `loadPackages(json: unknown): { name: string, description: string }[]`
  - `fetchDownloads(name: string, fetchImpl = fetch): Promise<number[]>`
  - `fetchRepoMeta(repo: string, token: string | undefined, fetchImpl = fetch): Promise<{ stars: number, language: string | null, license: string | null }>`

- [ ] **Step 1: テストを書く**（`fetchImpl`は、テストの中で作った偽物を渡す）
  - `loadPackages`
    - 名前が空のとき、説明が49文字以上のとき、配列でないときに、それぞれ例外を投げる
    - `config/packages.json`そのものを読み込んで、5件返る
  - `fetchDownloads`
    - `https://api.npmjs.org/downloads/range/last-month/<name>`を呼ぶ
    - `{downloads:[{day,downloads}]}`から、数値の配列を日付順に返す
    - 404のとき、`downloads`が配列でないとき、空配列のときに例外を投げ、メッセージにパッケージ名が入る
  - `fetchRepoMeta`
    - `https://api.github.com/repos/paveg/<repo>`を呼ぶ
    - `token`があれば`Authorization: Bearer <token>`を付ける
    - `stargazers_count`、`language`、`license.spdx_id`を返す。`license`が`null`なら`license: null`
    - 非2xxのときに例外を投げる
- [ ] **Step 2: 失敗を確かめる** Run: `pnpm run test` Expected: 新しいテストが失敗する
- [ ] **Step 3: 実装する**
  - `config/packages.json`の中身は次のとおり。順番はREADMEに並べる順。

```json
[
  { "name": "hono-problem-details", "description": "RFC 9457 problem+json error responses" },
  { "name": "hono-idempotency", "description": "Stripe-style Idempotency-Key middleware" },
  { "name": "hono-webhook-verify", "description": "Webhook signature verification" },
  { "name": "hono-cf-access", "description": "Country / ASN blocking and maintenance mode" },
  { "name": "hono-dpop", "description": "DPoP (RFC 9449) proof-of-possession" }
]
```

- [ ] **Step 4: 通ることを確かめる** Run: `pnpm run test` Expected: すべてpass
- [ ] **Step 5: コミット** `git commit -m "feat: npmとGitHubからカードのデータを取得する"`

### Task 3: 生成のエントリーポイントと定期実行

**Files:**
- Create: `scripts/generate.ts`, `.github/workflows/update-svgs.yml`, `assets/oss/*.svg`（生成物）
- Test: `tests/generate.test.ts`

**Interfaces:**
- Consumes: Task 1・2のすべて
- Produces: `buildCards(packages, { fetchImpl, token }): Promise<Map<string, string>>`（キーは`assets/oss/<name>-<theme>.svg`）と`writeCards(cards: Map<string,string>, rootDir: string): void`

- [ ] **Step 1: テストを書く**
  - `buildCards`
    - 偽の`fetchImpl`で5件分を渡すと、10個のキーが返る
    - 3件目のnpmだけ500を返すと例外になる
  - `writeCards`
    - 一時ディレクトリへ書くと、10ファイルできる
  - 失敗したときに何も書かないこと
    - `generate.ts`の`main`に偽の`fetchImpl`と一時ディレクトリを渡す
    - 1件失敗させたとき、一時ディレクトリに既存のファイルを置いておくと、そのまま残る
    - このために、`main({ fetchImpl, token, rootDir })`をexportする
- [ ] **Step 2: 失敗を確かめる** Run: `pnpm run test` Expected: 新しいテストが失敗する
- [ ] **Step 3: 実装する**
  - `main`は次の順で動く
    1. `config/packages.json`を読む
    2. `buildCards`（取得はすべて`Promise.all`）
    3. `writeCards`
  - 直接実行したとき（`import.meta.url`が`process.argv[1]`と一致）は、`main({ fetchImpl: fetch, token: process.env.GITHUB_TOKEN, rootDir: process.cwd() })`を呼ぶ。例外のときはメッセージを出して終了コード1
- [ ] **Step 4: ワークフローを書く** `.github/workflows/update-svgs.yml`
  - `on`: `schedule: [{ cron: "0 18 * * *" }]`と`workflow_dispatch`
  - `permissions: contents: write`、`concurrency: update-svgs`
  - ステップ
    - checkout
    - pnpm/action-setup
    - setup-node（`node-version: 26`、`cache: pnpm`）
    - `pnpm install --frozen-lockfile`
    - `pnpm run check`
    - `pnpm run generate`（`env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`）
    - `git add assets`のあと、`git diff --cached --quiet`が成功（差分なし）ならpushせずに終わる。差分があれば`github-actions[bot]`の名前（`41898283+github-actions[bot]@users.noreply.github.com`）で`chore: update README SVGs`をコミットしてpushする
  - アクションはSHAで固定する。SHAは`gh api repos/actions/checkout/git/ref/tags/v7.0.1 --jq .object.sha`のように取り、`# v7.0.1`をコメントに残す。tagが注釈付きタグのときは、`git/tags/<sha>`を引いてコミットのSHAにする
- [ ] **Step 5: 実データで生成する** Run: `GITHUB_TOKEN=$(gh auth token) pnpm run generate && ls assets/oss | wc -l && for f in assets/oss/*.svg; do xmllint --noout "$f"; done` Expected: `10`、xmllintのエラーなし
- [ ] **Step 6: コミット** `git commit -m "feat: OSSカードを毎日生成するワークフローを追加する"`（`assets/oss/`も含める）

### Task 4: READMEの置き換えと実機での確認

**Files:**
- Modify: `README.md`（「Featured OSS — Hono Middleware Suite」の表と「Stats」の節）

**Interfaces:**
- Consumes: Task 3の`assets/oss/<name>-{light,dark}.svg`

- [ ] **Step 1: READMEを書き換える**
  - 「Featured OSS」の見出しと、その下の2段落（説明と「If you find these useful…」）は残す
  - 表は、`config/packages.json`の順にカードを並べたものに置き換える。1件ごとに次の形にする

```html
<a href="https://github.com/paveg/hono-problem-details"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/oss/hono-problem-details-dark.svg"><img alt="hono-problem-details: RFC 9457 problem+json error responses" src="assets/oss/hono-problem-details-light.svg" width="420"></picture></a>
```

  - 「Stats」の節（devcardの画像2枚）は消す。「Elsewhere」は変えない
- [ ] **Step 2: ローカルで確かめる** Run: `grep -c 'devcard' README.md` Expected: `0`。`grep -c '<picture>' README.md` Expected: `5`
- [ ] **Step 3: コミット** `git commit -m "docs(readme): OSSの表とStatsをカードのSVGに置き換える"`
- [ ] **Step 4: 実機で確かめる（手動、pushの確認が要る）**
  - ユーザーの了承を得てから、ブランチをpushする
  - `https://github.com/paveg/paveg/tree/<branch>`のREADMEで、次を目で確かめる
    - カードが表示され、折れ線と星のアニメーションが再生されること（camoがCSSアニメーションを通すか）
    - ライトとダークの両方で表示されること
    - OSの「視差効果を減らす」をオンにして再読み込みしたとき、最初から完成した状態で出るか。出なくても、1回で止まることだけは確かめる
  - 結果をPRの本文に書く
- [ ] **Step 5: Actionsを手動で実行する（手動）** mainに入った後に`gh workflow run update-svgs.yml`を実行し、`gh run watch`で成功を確かめる。差分がなければ、コミットが増えないことも確かめる
