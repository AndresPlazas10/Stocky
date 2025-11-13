/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta personalizada de Stockly
        primary: {
          DEFAULT: '#003B46', // Azul petróleo
          50: '#E6F0F2',
          100: '#CCE1E5',
          200: '#99C3CB',
          300: '#66A5B1',
          400: '#338797',
          500: '#003B46', // Color principal
          600: '#002F38',
          700: '#00232A',
          800: '#00171C',
          900: '#000B0E',
        },
        secondary: {
          DEFAULT: '#07575B', // Verde azulado
          50: '#E7F2F3',
          100: '#CFE5E7',
          200: '#9FCBCF',
          300: '#6FB1B7',
          400: '#3F979F',
          500: '#07575B', // Color secundario
          600: '#064649',
          700: '#043437',
          800: '#032325',
          900: '#011112',
        },
        accent: {
          DEFAULT: '#66A5AD', // Color de acento
          50: '#F0F7F8',
          100: '#E1EFF1',
          200: '#C3DFE3',
          300: '#A5CFD5',
          400: '#87BFC7',
          500: '#66A5AD', // Acento
          600: '#52848A',
          700: '#3D6368',
          800: '#294245',
          900: '#142123',
        },
        background: {
          DEFAULT: '#C4DFE6', // Fondo claro
          light: '#E6F0F2',
          dark: '#003B46',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        foreground: "hsl(var(--foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
