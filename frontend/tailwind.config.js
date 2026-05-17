/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#1e1b4b',
        },
        surface: {
          900: '#060608',
          800: '#0d0d12',
          700: '#13131a',
          600: '#1a1a24',
          500: '#22222f',
          400: '#2e2e3e',
        }
      },
      fontFamily: {
        mono: ["'Geist Mono'", "'JetBrains Mono'", "'Fira Code'", 'monospace'],
        sans: ["'Inter'", 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up':   'fadeUp 0.3s ease both',
        'slide-in':  'slideIn 0.25s ease both',
        'pulse-slow':'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 2s linear infinite',
        'bar-grow':  'barGrow 0.6s cubic-bezier(0.4,0,0.2,1) both',
      },
      keyframes: {
        fadeUp:  { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'none' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'none' } },
        barGrow: { from: { width: '0%' }, to: {} },
      }
    },
  },
  plugins: [],
}
