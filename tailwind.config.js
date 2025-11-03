/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "./*.{js,ts}",
    "./**/*.{js,ts}",
    "!./node_modules/**"
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Pretendard'", 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans KR', 'sans-serif'],
      },
      colors: {
        brand: {
          indigo: '#6366f1',
          purple: '#8b5cf6',
        },
      },
      boxShadow: {
        'inner-soft': 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
    },
  },
  safelist: [
    {
      pattern: /^(bg|text|border)-(emerald|rose|indigo|violet|amber|slate)-(50|100|200|300|400|500|600|700)$/,
    }
  ],
  plugins: [],
};
