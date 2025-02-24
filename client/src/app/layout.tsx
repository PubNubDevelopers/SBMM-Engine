import type { Metadata } from "next";
import "./globals.css";
import { SBMContextProvider } from "../context/SBMContext";

export const metadata: Metadata = {
  title: "Skill Based Matchmaking (SBMM) Dashboard",
  description: "Skill Based Matchmaking Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        <SBMContextProvider>
          {children}
        </SBMContextProvider>
      </body>
    </html>
  );
}
