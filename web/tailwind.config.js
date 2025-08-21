/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'media', // Bu değeri 'media' olarak değiştirdik, böylece sistem her zaman karanlık modu tercih edecek
  theme: { extend: {} },
  plugins: [],
};
