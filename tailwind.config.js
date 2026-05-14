/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'moca-red': '#E52217',
        'moca-red-light': '#FFE7E6',
        'moca-black': '#191919',
        'moca-gray': '#8A8A8A',
      },
      fontFamily: {
        'figtree': ['Figtree', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
