# 使い方

## App.jsx
`src/App.jsx` をこのファイルで置き換えてください。

## App.css
`src/App.css` をこのファイルで置き換えてください。

## questions_sample.csv
Googleスプレッドシートの `questions` シートに貼り付けてください。

## main.jsx
通常のVite構成なら、`src/main.jsx` で以下のようにApp.cssを読み込んでください。

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './App.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

## デプロイ
```powershell
npm run build
git add .
git commit -m "complete study app"
git push
```
