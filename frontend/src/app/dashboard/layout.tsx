import type { Metadata } from "next";
import { DashboardProfileProvider } from "@/context/profile-context";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardProfileProvider>{children}</DashboardProfileProvider>;
}
