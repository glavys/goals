import './globals.css';

export const metadata = {
  title: 'Цели',
  description: 'Cash, зал, сон — до 31 декабря',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f4f0',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
