/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E293B',   // Navy gris oscuro elegante
          light: '#334155',     // Hover / fondos suaves
          dark: '#0F172A',      // Para bordes o header fijo
        },
        accent: {
          DEFAULT: '#0EA5E9',   // Azul petróleo elegante
          dark: '#0284C7',
        },
        success: '#16A34A',
        error: '#DC2626',
        warning: '#FACC15',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0,0,0,0.06)',
        hover: '0 4px 16px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
