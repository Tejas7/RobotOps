import "./globals.css";
import { Providers } from "@/components/layout/providers";

export const metadata = {
  title: "RobotOps",
  description: "Robotics operations and orchestration dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="page-shell" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
