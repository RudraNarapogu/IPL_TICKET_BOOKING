/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ED1C24', // BookMyShow Red
          dark: '#c1121f',
        },
        secondary: '#2B3148',
      }
    },
  },
  plugins: [],
}
