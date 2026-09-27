/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Corporate identity specification CI/01, section 05.
        ink: '#0A0A0A',
        soft: '#111111',
        paper: '#F4F3EF',
        quest: '#E4601F',
      },
      fontFamily: {
        // CI/01 section 06: Inter is the one typeface.
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        page: '1600px',
      },
    },
  },
  plugins: [],
};
