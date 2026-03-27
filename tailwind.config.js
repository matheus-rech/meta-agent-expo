/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#0D1117",
          surface: "#161B22",
          border: "#30363D",
          accent: "#58A6FF",
          text: "#C9D1D9",
          muted: "#8B949E",
          dim: "#484F58",
          error: "#F85149",
          success: "#3FB950",
          warning: "#D29922",
          purple: "#A371F7",
        },
      },
      fontFamily: {
        mono: ["SpaceMono", "Courier", "monospace"],
      },
    },
  },
  plugins: [],
};
