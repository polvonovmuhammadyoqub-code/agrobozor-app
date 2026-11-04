/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agro: {
          dark: '#0F2F25',
          green: '#1B4D3E',
          lightGreen: '#2D7560',
          paleGreen: '#E8F3EE',
          amber: '#F59E0B',
          amberDark: '#D97706',
          amberLight: '#FEF3C7',
        }
      }
    },
  },
  plugins: [],
}
