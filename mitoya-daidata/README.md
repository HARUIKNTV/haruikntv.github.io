# 丸三三刀屋店 台データビューア

丸三三刀屋店がLINE公式アカウントで配信している台データ（差枚・差玉・回転数・BB/RB回数など）を、
見やすい表とグラフで表示し、過去の傾向も確認できるようにするための静的アプリです。
ビルド不要、GitHub Pagesでそのまま配信されます。

- 公開URL: https://haruikntv.github.io/mitoya-daidata/
- サンプルデータでのプレビュー: アプリ内の「サンプルデータでプレビュー」ボタンから確認できます。

## なぜ「LINE APIで自動取得」ではないのか

LINEのMessaging APIには、公式アカウントが**過去に配信したブロードキャストの内容を外部から
取得する公開APIは存在しません**（Webhookは「ユーザーからアカウントへの」メッセージ受信用で、
アカウント自身が送った配信内容を後から読み出す用途には使えません）。そのため、配信画像を
起点に、画像認識で構造化データへ変換する下記のパイプラインを採用しています。

## データの流れ

```
LINE配信画像
   ↓ (店舗スタッフ等がアップロード)
mitoya-daidata/incoming/2026-09-22.jpg
   ↓ (push)
GitHub Actions (.github/workflows/mitoya-daidata-ingest.yml)
   ↓ Claude Vision で表データを抽出
mitoya-daidata/data/history.json  ← 蓄積される台データ本体
   ↓ (画像は mitoya-daidata/processed/ へ移動)
mitoya-daidata/index.html が history.json を読み込んで表・グラフを描画
```

### 運用手順（画像を置くだけ）

1. LINEで配信された台データのスクリーンショットを保存する。
2. ファイル名を `YYYY-MM-DD.jpg`（同日に複数枚ある場合は `YYYY-MM-DD-1.jpg`, `YYYY-MM-DD-2.jpg` など）にする。
3. `mitoya-daidata/incoming/` に追加してmainブランチにpush（GitHubのモバイルアプリ/Web UIからのアップロードでも可）。
4. GitHub Actionsが自動的に画像を解析し、`data/history.json` を更新してコミットする。
5. 数分後にサイトを再読み込みすると、その日のデータが反映されている。

事前準備として、リポジトリの Settings > Secrets and variables > Actions に
`ANTHROPIC_API_KEY` を登録する必要があります（Claude APIの利用料が発生します）。

### 手動でデータを追加する場合

`ANTHROPIC_API_KEY` を用意できない場合や、テキストデータをそのまま反映したい場合は、
`mitoya-daidata/data/history.json` を直接編集しても構いません。スキーマは下記の通りです。

## データスキーマ（`data/history.json`）

```jsonc
[
  {
    "date": "2026-09-22",
    "store": "丸三三刀屋店",
    "machines": [
      {
        "unit_no": "101",       // 台番号
        "model": "P機種名",      // 機種名
        "genre": "pachinko",    // "pachinko" | "slot" | ""
        "diff": 1234,           // 差枚/差玉(符号付き整数。マイナスは負の値)
        "total_games": 8500,    // 総回転数/ゲーム数(不明ならnull)
        "counts": { "大当り": 12 }, // ボーナス等の回数。BB/RB/ART/CZ/大当りなど画像にある項目名をそのままキーにする
        "note": ""              // 任意の備考
      }
    ]
  }
]
```

同じ`date`のエントリは1つだけで、追記/取り込みスクリプトは既存の同日データを置き換えます
（再解析による修正が安全に行えます）。

## ローカルでの手動実行

```sh
cd mitoya-daidata/tools
npm install
ANTHROPIC_API_KEY=sk-ant-... node parse-image.mjs --date 2026-09-22 ../incoming/2026-09-22.jpg
```

## ディレクトリ構成

- `index.html` / `app.js` / `style.css` — 表示アプリ本体
- `data/history.json` — 実データ本体（蓄積されていく）
- `sample-data/history.json` — デモ用のダミーデータ（実データではない）
- `incoming/` — 未処理の配信画像を置く場所
- `processed/` — 取り込み済み画像のアーカイブ
- `tools/` — 画像解析スクリプト
