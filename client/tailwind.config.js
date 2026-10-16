/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        glass: {
          100: 'rgba(255, 255, 255, 0.05)',
          200: 'rgba(255, 255, 255, 0.08)',
          300: 'rgba(255, 255, 255, 0.12)',
        },
        accent: {
          DEFAULT: '#6366f1', // Indigo 500
          hover: '#4f46e5', // Indigo 600
          glow: 'rgba(99, 102, 241, 0.5)'
        },
        success: {
          DEFAULT: '#10b981', // Emerald 500
          glow: 'rgba(16, 185, 129, 0.4)'
        },
        warning: {
          DEFAULT: '#f59e0b', // Amber 500
          glow: 'rgba(245, 158, 11, 0.4)'
        },
        dark: {
          bg: '#0B0F19',
          panel: '#151C2C',
          border: 'rgba(255, 255, 255, 0.08)'
        }
      }
    }
  },
  plugins: [],
}
