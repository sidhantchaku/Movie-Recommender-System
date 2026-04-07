import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Movie AI Chatbot",
  description: "A GenAI movie search chatbot built with Next.js and Vercel AI Gateway."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
