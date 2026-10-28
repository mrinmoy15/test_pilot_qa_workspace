import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TestPilot — QA Workspace",
  description: "A test case and release quality dashboard for QA teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
