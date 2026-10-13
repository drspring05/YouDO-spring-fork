/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        'base': 'var(--bg-base)',
        'surface': 'var(--bg-surface)',
        'elevated': 'var(--bg-elevated)',
        'sheet': 'var(--bg-sheet)',
        'fill': 'var(--bg-fill)',
        
        'primary': 'var(--primary)',
        'primary-soft': 'var(--primary-soft)',
        'primary-glow': 'var(--primary-glow)',
        'on-primary': 'var(--on-primary)',
        
        'secondary': 'var(--secondary)',
        'secondary-soft': 'var(--secondary-soft)',
        
        'accent': 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-soft': 'var(--accent-soft)',
        
        'success': 'var(--success)',
        'success-soft': 'var(--success-soft)',
        
        'warning': 'var(--warning)',
        
        'error': 'var(--error)',
        'error-soft': 'var(--error-soft)',
        'on-accent': 'var(--on-accent)',
        'border': 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
      },
      textColor: {
        'content': {
          'primary': 'var(--text-primary)',
          'secondary': 'var(--text-secondary)',
          'muted': 'var(--text-muted)',
        }
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        'subtle': 'var(--border-subtle)',
        'surface': 'var(--bg-surface)',
        'base': 'var(--bg-base)',
        'elevated': 'var(--bg-elevated)',
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'elevated': 'var(--shadow-elevated)',
      },
      // Apple-style continuous corners: larger, softer radii across the scale.
      borderRadius: {
        'lg': '10px',
        'xl': '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};
