import type { Metadata } from "next";
import "@fontsource-variable/source-sans-3";
import "@fontsource-variable/source-code-pro";
import "@fontsource/lora/700.css"; // Lora Bold — project title
import "./globals.css";

export const metadata: Metadata = {
  title: "SlopStudio Pro",
  description:
    "A desktop-class, high-performance non-linear video editor with built-in AI generation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
