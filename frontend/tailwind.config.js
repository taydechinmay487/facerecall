/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F5F0",
        surface: "#FFFFFF",
        "surface-muted": "#F1EEE7",
        ink: "#14213D",
        "ink-soft": "#33415C",
        muted: "#596475",
        line: "#E2DDD2",
        accent: {
          DEFAULT: "#0F6B66",
          strong: "#0B534F",
          soft: "#E3F0EE",
        },
        caution: {
          DEFAULT: "#8A5A00",
          soft: "#FBF0D9",
        },
        danger: {
          DEFAULT: "#9B2C2C",
          soft: "#FBEAEA",
        },
      },
      borderRadius: {
        card: "1rem",
        control: "0.625rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 33, 61, 0.04), 0 8px 24px -18px rgba(20, 33, 61, 0.25)",
        focus: "0 0 0 3px rgba(15, 107, 102, 0.28)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      transitionDuration: {
        calm: "180ms",
      },
    },
  },
  plugins: [],
};
