# 忘却曲線・間隔反復・学習カレンダー版

## 追加内容

- 復習スケジューリングを追加
- `nextReviewAt` による次回復習日管理
- 間違えやすい問題は短期連続正解してもスコアを下げすぎない
- 正解が続くと復習間隔を 1日→3日→7日→14日→30日 へ拡大
- `weakWeight` で苦手度を累積管理
- 日ごとの学習履歴を `daily` に保存
- 学習カレンダー画面を追加

## 置き換えるファイル

- `src/App.jsx`
- `src/App.css`

## 注意

履歴キーを v3 に変更しています。
以前のv2履歴とは別管理になります。

## デプロイ

```powershell
npm run build
git add .
git commit -m "add spaced repetition and calendar"
git push
```
