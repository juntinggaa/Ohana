/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // A sunlit home palette: cream, cocoa, peach and garden green.
        paper: {
          DEFAULT: '#FFF9F2',
          50:  '#FFFCF8',
          100: '#FFF0E4',
          200: '#F2DDCE',
        },
        ink: {
          DEFAULT: '#44362F',
          900: '#3C2D28',
          800: '#4B3831',
          700: '#604B43',
          600: '#76635B',
          500: '#907C72',
          400: '#B5A398',
          300: '#D6C7BD',
          200: '#EADFD6',
          100: '#F5EDE7',
        },
        rouge: {
          DEFAULT: '#DC746B',
          50:  '#FFF2EF',
          100: '#FCE1DA',
          200: '#F5C8BE',
          300: '#EDAAA0',
          400: '#E58B80',
          500: '#DC746B',
          600: '#C75C54',
          700: '#A34842',
          800: '#763530',
        },
        moss: {
          DEFAULT: '#6E9170',
          50:  '#F1F7EF',
          100: '#DFECDC',
          400: '#8CAC8A',
          500: '#6E9170',
          600: '#57765A',
        },
        honey: {
          50: '#FFF8E7',
          100: '#FCECC8',
          300: '#EFCC78',
          500: '#C79339',
        },
      },
      fontFamily: {
        serif: ['"LXGW WenKai"', '"Noto Serif SC"', '"Songti SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
        // 大号数字专用 —— oldstyle tabular
        numeric: ['"GT Sectra"', '"Newsreader"', 'Georgia', 'serif'],
      },
      fontSize: {
        // 重新设计的字阶 —— 编辑风
        'eyebrow': ['12px', { lineHeight: '18px', letterSpacing: '0.06em' }],
        'micro':   ['11px', { lineHeight: '15px' }],
        'tiny':    ['12px', { lineHeight: '17px' }],
        'small':   ['13px', { lineHeight: '20px' }],
        'body':    ['15px', { lineHeight: '24px' }],
        'lead':    ['17px', { lineHeight: '27px' }],
        'h3':      ['22px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        'h2':      ['30px', { lineHeight: '36px', letterSpacing: '-0.015em' }],
        'h1':      ['44px', { lineHeight: '50px', letterSpacing: '-0.02em' }],
        'display': ['72px', { lineHeight: '76px', letterSpacing: '-0.03em' }],
      },
      letterSpacing: {
        widest: '0.22em',
      },
      boxShadow: {
        soft:  '0 2px 10px rgba(128, 84, 62, 0.06), 0 10px 30px -16px rgba(128, 84, 62, 0.12)',
        card:  '0 2px 8px rgba(128, 84, 62, 0.06), 0 18px 42px -20px rgba(128, 84, 62, 0.2)',
        modal: '0 20px 64px -16px rgba(86, 54, 42, 0.24)',
      },
      animation: {
        'fade-up':   'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in':   'fade-in 0.5s ease-out both',
        'bar-fill':  'bar-fill 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'bar-fill': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
    },
  },
  plugins: [],
}
