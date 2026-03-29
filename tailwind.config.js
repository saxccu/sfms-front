/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        'lemon-cream': '#FAF9F6',
        'emerald-soft': '#F0FDF4',
        'emerald-dark': '#064E3B',
        'emerald-primary': '#10B981',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
