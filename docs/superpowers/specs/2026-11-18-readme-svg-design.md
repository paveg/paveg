# プロフィールREADMEの動くSVG：設計

## 目的
GitHubのプロフィールREADME（paveg/paveg）を、devcardに頼らずに見栄えよく保つ。READMEではJSを使えないので、CIで生成した動くSVGを置く。

devcardは、キャッシュが切れた瞬間にGitHub APIの応答を待つ作りで、表示が止まりやすかった。生成をCIに移し、出来上がったSVGをリポジトリにコミットすれば、READMEの表示は外部のサービスに依存しなくなる。

## 見せるもの
- **Featured OSS**: 自分のHonoミドルウェア5つを、パッケージごとのカードで見せる。カードには、パッケージ名、星のアイコンとスター数、説明、30日間の日ごとのダウンロード数の折れ線、言語の色の点、ライセンス、30日間のダウンロード数の合計を載せる。カードごとにリポジトリへリンクする。
- **Career（後から足す）**: me.funailog.comと同じ経歴トレースの英語版。見出しに、LinkedInのヘッドラインと同じ肩書「Site Reliability Engineer / Platform Engineer / Tech Lead」と会社、開始月を出す。画像全体からme.funailog.com/en/へリンクする。

他の人のリポジトリへの貢献は載せない。マージ済みのPRは、ほとんどが仕事や受託のリポジトリで、出してはいけない取引先が見えてしまうため。Hono本体などへの貢献が増えたら、そのときに欄を足す。

見た目は、サンプルで合意したものに従う。色はme.funailog.comと同じ値を使い、ライトとダークの2枚を作って`<picture>`で出し分ける。アニメーションは、READMEを開いたときに一度だけ再生し、必ず完成した状態で止める。

## 作らないもの
- ホバーやクリックで変わる表現（`<img>`で表示したSVGではJavaScriptが無効で、外部のリソースも読み込めない。MDN「SVG as an image」）
- 外部のフォントの読み込み（SVGの中ではOS標準のsans-serifを使う）
- 他の人へのdevcardの提供の続き

## 作り方の選択肢
| 案 | 中身 | 判断 |
|---|---|---|
| A | スクリプトはpaveg/pavegに置き、経歴YAMLは公開リポジトリのpaveg/meから読む | **採用**。データの出どころが1か所で、トークンはActions標準の`GITHUB_TOKEN`だけで済む |
| B | スクリプトはpaveg/meに置き、paveg/pavegへSVGをpushする | トレースの計算は使い回せるが、別リポジトリへのpushに個人アクセストークンかGitHub Appが要る。期限切れで止まるおそれがある |
| C | paveg/pavegだけで完結させ、経歴データも複製する | 経歴を2か所で直すことになり、そのうち食い違う |

## 決めたこと
- **順番**: 次の順に進める。
  1. OSSカードを作り、READMEのStatsと言語のカード、OSSの表を置き換える
  2. devcardを閉じる（gh-infraでのアーカイブと、Cloudflare上のWorkerとKVの削除）
  3. paveg/meに経歴YAML（ポートフォリオv1のTask 2）が入ったら、経歴トレースを足す
- **定期実行**: GitHub Actionsで1日1回と、手動実行（`workflow_dispatch`）で動かす。
- **失敗したとき**: データの取得が1つでも失敗したら、ジョブを失敗させてコミットしない。前回のSVGが残るので、READMEの画像は壊れない。失敗はActionsの通知で気づく。
- **差分がないとき**: SVGが前回と同じなら、コミットしない。
- **データの取り方**:
  - ダウンロード数は、npmのAPI（`api.npmjs.org/downloads/range/last-month/<name>`）から取る。
  - スター数、言語、ライセンスは、GitHubのREST APIから`GITHUB_TOKEN`で取る。
  - 経歴は、paveg/meの経歴YAMLを取る。
- **手で持つデータ**: パッケージの一覧と英語の説明だけは、paveg/pavegの設定ファイルに書く。
- **言語とツール**: コードはTypeScriptで書き、Node 26の型除去で実行する。パッケージマネージャーはpnpmにする。
- **依存パッケージ**: 実行時の依存パッケージは持たない。型チェック、lint、フォーマットのために、typescript・@types/node・oxlint・oxfmtだけを開発用に入れる。
- **書き込みトークン**: checkoutは認証情報を`.git/config`に残さない（`persist-credentials: false`）。リポジトリへの書き込み権限を持つ`GITHUB_TOKEN`は、pushするステップにだけ渡す。
- **画像プロキシ（camo）**: READMEの相対パスの画像はcamoを通らない。`github.com/<owner>/<repo>/raw/<branch>/...`から`image/svg+xml`で配信され、SVGの中の`@keyframes`も残る。ブランチのREADMEとプロフィールページで確かめた。

## 実装する人に任せること
- スクリプトの構成。
- SVGの細かな座標。サンプルの見た目から外れない範囲で調整してよい。
- コミットメッセージの書式。

## 私の判断で決めたこと（確認してほしい）
- **実行時刻**: 毎日日本時間の3時（`cron: '0 18 * * *'`）にする。
- **出力先**: SVGは`assets/`の下に置く。READMEからは相対パスで参照する。
- **アクションの固定**: ワークフローで使うアクションは、コミットのSHAで固定する。paveg/pavegのgh-infraの設定は`sha_pinning_required: false`だが、paveg/meと揃えるため。
- **READMEの表**: いまの表（パッケージ、説明、ダウンロード数のバッジ）は、カードに置き換えて消す。カードに同じ情報が載るため。
- **Elsewhereのリンク**: 「Portfolio」のリンクは、me.funailog.comが公開されるまで変えない。

## まだ確かめていないこと
- 動きを減らす設定（`prefers-reduced-motion`）が、`<img>`で表示したSVGの中まで届くか。ヘッドレスのChromeで試したときは、効いたかどうかを判断できなかった。実装したら、実際のブラウザで設定を切り替えて確かめる。
