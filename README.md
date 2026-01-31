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
