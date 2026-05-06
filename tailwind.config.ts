import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'brand-orange': '#F97316',
        'brand-brown': '#7C3F00',
      },
    },
  },
  plugins: [],
}

export default config
