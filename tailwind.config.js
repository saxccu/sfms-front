/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /** SFMS: graphite surfaces + teal accent (replaces saturated blue/red shell) */
        brand: {
          950: '#0b0f14',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#0d9488',
          500: '#14b8a6',
          400: '#2dd4bf',
          300: '#5eead4',
          100: '#ccfbf1',
          50: '#f0fdfa',
        },
        /** Alias for buttons/focus rings across pages (same as brand) */
        primary: {
          950: '#0b0f14',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#0d9488',
          500: '#14b8a6',
          400: '#2dd4bf',
          300: '#5eead4',
          100: '#ccfbf1',
          50: '#f0fdfa',
        },
      },
    },
  },
  plugins: [],
}

