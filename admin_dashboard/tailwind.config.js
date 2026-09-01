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
        background: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceMuted: '#F1F5F9',
        border: '#E2E8F0',
        primary: {
          DEFAULT: '#0F172A',
          hover: '#1E293B',
          light: '#334155',
        },
        secondary: {
          DEFAULT: '#64748B',
          light: '#94A3B8',
        },
        status: {
          success: '#16A34A',
          successBg: '#F0FDF4',
          successBorder: '#BBF7D0',
          warning: '#D97706',
          warningBg: '#FFFBEB',
          warningBorder: '#FDE68A',
          danger: '#DC2626',
          dangerBg: '#FEF2F2',
          dangerBorder: '#FECACA',
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
