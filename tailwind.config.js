/** @type {import('tailwindcss').Config} */
export default {
  content: ['./overlay/index.html', './overlay/src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // GameStack-ish accent palette for overlays.
        ink: '#0b0e14',
        accent: '#7c5cff',
        accent2: '#22d3ee',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
