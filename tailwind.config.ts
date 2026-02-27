import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F2EEE8',
        forest: '#375946',
        slate: '#5e8290',
        lime: '#E9F966',
        taupe: '#868875',
        deepred: '#631E1E',
        'accent-green': '#00F7A5',
        'accent-teal': '#00C997',
        'bg-dark': '#16161B',
        'bg-dark-secondary': '#202026',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['Monaco', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
