/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#085041",
          dark: "#053d32",
          light: "#0d6b58",
        },
      },
    },
  },
  plugins: [],
};
