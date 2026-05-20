/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./frontend/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#121417",
        panel: "#191d22",
        line: "#2a3038",
        moss: "#6fd08c",
        ember: "#f1b65c",
        muted: "#9aa4b2",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

