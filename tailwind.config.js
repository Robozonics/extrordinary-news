/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-lime': '#C6FF00',
        'brand-pink': '#FF2E93',
        'brand-cyan': '#00F0FF',
        'brand-purple': '#8B5CF6',
        'paper-bg': '#F5F2E9',
        'paper-ink': '#1A1816',
        'cyber-bg': '#090A0F',
        'cyber-card': '#111520',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        serif: ['Merriweather', 'serif'],
        broadsheet: ['Playfair Display', 'Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
}
