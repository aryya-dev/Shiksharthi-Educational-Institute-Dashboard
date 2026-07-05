import React from 'react';
import './globals.css';
import LayoutClient from './layout-client';

export const metadata = {
  title: 'Shiksharthi OS',
  description: 'Internal operations platform for Shiksharthi coaching institute',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
