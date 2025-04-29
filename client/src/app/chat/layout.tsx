import { DashboardProvider } from "@/providers/dashboard-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <DashboardProvider>{children}</DashboardProvider>
    </div>
  );
}
