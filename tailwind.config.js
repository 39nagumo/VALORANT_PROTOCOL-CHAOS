/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // サイトの画面の字（対戦ロビーの見た目）。OBS 用の表示には使わない
        lobby: ['"LINE Seed JP"', '"Hiragino Sans"', '"Yu Gothic UI"', 'Meiryo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
