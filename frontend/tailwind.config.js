export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        surface: {
          50:  '#f8f8f8',
          100: '#f0f0f0',
          800: '#1a1a1a',
          850: '#141414',
          900: '#0f0f0f',
          950: '#0a0a0a',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
        'brand-gradient-dark': 'linear-gradient(135deg, #ea580c 0%, #d97706 100%)',
        'surface-gradient': 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)',
        'glow-orange': 'radial-gradient(ellipse at center, rgba(249,115,22,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'brand': '0 0 20px rgba(249, 115, 22, 0.25)',
        'brand-sm': '0 0 10px rgba(249, 115, 22, 0.15)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
