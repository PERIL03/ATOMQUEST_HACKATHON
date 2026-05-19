/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        serif: ["'Libre Baskerville'", "serif"],
      },
      colors: {
        ink: "#0d1025",
        haze: "#f4f2ef",
        sun: "#f6c267",
        coral: "#f0765a",
        sea: "#3a6ea5",
        moss: "#2f7f6d",
      },
      boxShadow: {
        glow: "0 20px 60px rgba(16, 24, 40, 0.2)",
      },
    },
  },
  plugins: [],
};
