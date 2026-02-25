import React from 'react';
import './globals.css';

export const metadata = {
  title: 'DC Energy | Prismatic Cell Processor',
  description: 'A tool for processing and visualizing prismatic cell battery data from Excel files.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#000000] text-white font-sans selection:bg-[#65913B] selection:text-white">
        {children}
      </body>
    </html>
  );
}
