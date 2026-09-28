# VALORANT Custom CHAOS Gacha

An agent and rule randomizer for VALORANT custom games.
Built with React, TypeScript, and Vite.

## Setup & Running

**Prerequisites:** Node.js (v18+)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
    *Note: Since this project was generated in a mocked environment, you must run this first!*

2.  **Start Dev Server:**
    ```bash
    npm run dev
    ```

3.  **Run Tests:**
    ```bash
    npm test
    ```

## Configuration

### Adding Agents
Edit `src/data/agents.json`.
Format:
```json
{ "name": "Name", "role": "Duelist", "image": "/assets/agents/name.png" }
```
*Note: You need to add the corresponding image files to `src/assets/agents/` manually.*

### Adding Binds (Rules)
Edit `src/data/binds.json`.  
Add strings to the corresponding "Rarity" array.

## ルーム機能（みんなで同期・OBS表示）

- 画面：`/r/:roomId`（ルーム）、`/me/:uid`（OBSのブラウザソース用・背景透過）
- 同期サーバー：`worker/`（Cloudflare Workers + Durable Objects）。ルームごとの名簿・抽選結果を保持し、WebSocketで全員に配る

### ローカルで動かす
```bash
npm --prefix worker install
npm --prefix worker run dev   # 同期サーバー（http://127.0.0.1:8787）
npm run dev                   # サイト（/rs は Vite が同期サーバーへ中継）
```
開発中だけ `/dev/reveal?kind=team&t=99999` で演出の見た目を確認できる（本番ビルドには入らない）。

### 公開
```bash
npm --prefix worker run deploy   # 同期サーバーをCloudflareへ
```
サイト側は `src/room/connection.ts` の同期サーバーのURL（本番用）を参照する。環境変数 `VITE_ROOM_SERVER` があればそちらを優先。

## Deployment
This is a standard Vite SPA.
```bash
npm run build
```
Upload the `dist` folder to Vercel, Netlify, or GitHub Pages.

## Tech Stack
-   **Framework**: React 18 + TypeScript
-   **Build Tool**: Vite
-   **Styling**: Tailwind CSS
-   **Utilities**: `html2canvas` for image generation
-   **Testing**: Vitest

## License
MIT
