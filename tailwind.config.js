/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        risk: {
          1: '#3b82f6', // Blue
          2: '#f59e0b', // Amber
          3: '#ef4444', // Red
          4: '#7f1d1d', // Dark Red
        },
        safe: {
          bg: '#f8fafc',
          ink: '#0f172a',
        },
      },
    },
  },
  plugins: [],
}