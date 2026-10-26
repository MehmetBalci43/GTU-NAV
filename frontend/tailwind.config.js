/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        canvas: {
          light: '#F4F5F7',
          dark: '#1E222D',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#282D3C',
        },
        neo: {
          border: '#18181B',
          'border-dark': '#0D1117',
          shadow: '#18181B',
          'shadow-dark': '#080A0F',
          rose: '#FB7185',
          indigo: '#818CF8',
          amber: '#FBBF24',
          mint: '#34D399',
          sky: '#38BDF8',
          emerald: '#10B981',
          crimson: '#EF4444',
        },
      },
      boxShadow: {
        'hard-sm': '2px 2px 0px #18181B',
        'hard': '3px 3px 0px #18181B',
        'hard-md': '4px 4px 0px #18181B',
        'hard-lg': '5px 5px 0px #18181B',
        'hard-night-sm': '2px 2px 0px #080A0F',
        'hard-night': '3px 3px 0px #080A0F',
        'hard-night-md': '4px 4px 0px #080A0F',
        'hard-night-lg': '5px 5px 0px #080A0F',
      },
      borderRadius: {
        'neo-sm': '8px',
        'neo': '12px',
        'neo-md': '16px',
        'neo-lg': '24px',
      },
    },
  },
  plugins: [],
};
