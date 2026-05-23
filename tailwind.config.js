/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Editorial palette · 暖白 / 深墨 / 单一赭红
        paper: {
          DEFAULT: '#F7F3EB',   // 主背景 · warm cream
          50:  '#FBF9F4',
          100: '#F2EDE3',
          200: '#E6DECF',
        },
        ink: {
          DEFAULT: '#171411',   // 几乎黑，偏暖
          900: '#0F0D0B',
          800: '#1B1816',
          700: '#33302C',
          600: '#5B5650',
          500: '#807A72',
          400: '#A8A39A',
          300: '#C9C4BC',
          200: '#E1DBD0',
          100: '#EDE7DC',
        },
        rouge: {
          // 唯一彩色 · 烧赭红，沉得住
          DEFAULT: '#B5462D',
          50:  '#FAEDE8',
          100: '#F2D2C7',
          200: '#E5A593',
          400: '#CC684A',
          500: '#B5462D',
          600: '#963921',
          700: '#722918',
          800: '#4F1B0F',
        },
        moss: {
          DEFAULT: '#46583C',
          50:  '#EEF1EA',
          100: '#DBE2D2',
          400: '#728168',
          500: '#46583C',
          600: '#384730',
        },
      },
      fontFamily: {
        // Editorial · serif headlines, refined sans body
        serif: ['"Source Han Serif SC"', '"Noto Serif SC"', '"Songti SC"', 'Georgia', 'serif'],
        sans: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
        // 大号数字专用 —— oldstyle tabular
        numeric: ['"GT Sectra"', '"Newsreader"', 'Georgia', 'serif'],
      },
      fontSize: {
        // 重新设计的字阶 —— 编辑风
        'eyebrow': ['10px', { lineHeight: '14px', letterSpacing: '0.18em' }],
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
        soft:  '0 1px 2px rgba(23, 20, 17, 0.04), 0 4px 16px -8px rgba(23, 20, 17, 0.08)',
        card:  '0 1px 2px rgba(23, 20, 17, 0.04), 0 8px 32px -12px rgba(23, 20, 17, 0.12)',
        modal: '0 16px 48px -8px rgba(23, 20, 17, 0.22)',
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
