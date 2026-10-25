const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './components/**/*.{ts,tsx}', 
    './src/**/*.{ts,tsx}', 
    './dist/**/*.{js,jsx,ts,tsx}',
  ],
  safelist: ['ProseMirror'],
  theme: {
    extend: {
      colors: {
        notion: {
          dark: '#191919',
          panel: '#202020',
          popup: '#252525',
          text: '#e3e3e3',
          subtext: '#9b9b9b',
          hover: 'rgba(255, 255, 255, 0.06)',
          accent: 'rgba(255, 255, 255, 0.1)',
        },
      },
      backgroundColor: {
        'notion-dark': '#191919',
        'notion-panel': '#202020',
        'notion-popup': 'rgba(37, 37, 37, 0.85)',
        'notion-hover': 'rgba(255, 255, 255, 0.06)',
        'notion-accent': 'rgba(255, 255, 255, 0.1)',
      },
      textColor: {
        'notion-text': '#e3e3e3',
        'notion-subtext': '#9b9b9b',
      },
      borderColor: {
        'notion-border': 'rgba(255, 255, 255, 0.1)',
      },
      boxShadow: {
        'glass-inset': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
}
