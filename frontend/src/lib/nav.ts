import {
  LayoutDashboard,
  User,
  Link2,
  FolderGit2,
  Palette,
  Plug,
  BarChart3,
  Settings,
  LogOut,
  Home,
  GitBranch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const NAV_GROUPS: Array<{ label?: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: "Profile",
    items: [
      { href: "/dashboard/profile", label: "Your Profile", icon: User },
      { href: "/dashboard/links", label: "Links", icon: Link2 },
      { href: "/dashboard/projects", label: "Projects", icon: FolderGit2 },
      { href: "/dashboard/appearance", label: "Theme & Style", icon: Palette },
    ],
  },
  {
    label: "Integrations",
    items: [
      { href: "/dashboard/integrations", label: "Connected Apps", icon: Plug },
      { href: "/test-github", label: "GitHub Explorer", icon: GitBranch },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export const PUBLIC_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
];

export const USER_ACTIONS: Array<{
  label: string;
  icon: LucideIcon;
  onSelect?: "logout";
}> = [{ label: "Sign out", icon: LogOut, onSelect: "logout" }];
