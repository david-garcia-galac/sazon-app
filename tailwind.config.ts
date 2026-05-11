import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'brand-orange': '#F97316',
        'brand-brown':  '#92400E',
        'warm-bg':      '#F7F4F1',
        'warm-card':    '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)',
        'card-lg': '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.07)',
        'orange':  '0 4px 16px rgba(249,115,22,0.38)',
        'red':     '0 4px 16px rgba(239,68,68,0.32)',
      },
    },
  },
  plugins: [],
}

export default config
