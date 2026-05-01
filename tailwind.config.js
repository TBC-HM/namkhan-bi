/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Soho-house style casual luxury palette per 11_BRAND_AND_UI_STANDARDS
        ink: '#1a1a1a',
        bg: '#0e0e0e',
        panel: '#161616',
        panel2: '#1c1c1c',
        line: '#2a2a2a',
        text: '#e8e4dc',
        muted: '#7a7670',
        sand: '#bfa980',
        sandlight: '#d4c5a0',
        red: '#c25450',
        green: '#7a9b6a',
        amber: '#d4a96a',
        slh: '#9a8866'
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      letterSpacing: { wide2: '0.08em', wide3: '0.14em' },
      gridTemplateColumns: {
        '15': 'repeat(15, minmax(0, 1fr))',
        '30': 'repeat(30, minmax(0, 1fr))'
      }
    }
  },
  plugins: []
};
