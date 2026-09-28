import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ReactDOM from 'react-dom/client'
import App from './App'
import { OverlayPage } from './room/OverlayPage'
import { DevPreview } from './room/DevPreview'
import './index.css'   // ★ これが最重要

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* OBS用はサイトの枠（ロゴ・背景）なしで表示する */}
        <Route path="/me/:uid" element={<OverlayPage />} />
        {import.meta.env.DEV && <Route path="/dev/reveal" element={<DevPreview />} />}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
