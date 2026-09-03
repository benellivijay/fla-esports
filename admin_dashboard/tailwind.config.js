/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0E17',
        surface: '#1A2036',
        surfaceMuted: '#222944',
        border: '#2A3150',
        textPrimary: '#E8EAF0',
        textSecondary: '#8A8FA3',
        textMuted: '#8A8FA3',
        primary: {
          DEFAULT: '#3DDCFF', // Electric blue
          hover: '#33C7E8',
          dark: '#0B0E17',
          light: '#65E3FF',
        },
        secondary: {
          DEFAULT: '#7B5CFF', // Violet
          hover: '#6B4BE8',
          light: '#9E86FF',
        },
        highlight: '#F4B33C', // Gold
        status: {
          success: '#2ED47A',
          successBg: 'rgba(46, 212, 122, 0.12)',
          successBorder: 'rgba(46, 212, 122, 0.25)',
          warning: '#F4B33C',
          warningBg: 'rgba(244, 179, 60, 0.12)',
          warningBorder: 'rgba(244, 179, 60, 0.25)',
          danger: '#FF5C6C',
          dangerBg: 'rgba(255, 92, 108, 0.12)',
          dangerBorder: 'rgba(255, 92, 108, 0.25)',
        }
      },
      borderRadius: {
        'pill': '9999px',
        'card': '12px',
      },
      borderWidth: {
        'hairline': '0.5px',
      }
    },
  },
  plugins: [],
};
