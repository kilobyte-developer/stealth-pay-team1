import {
  ArrowDownToLine,
  KeyRound,
  LayoutDashboard,
  Radar,
  ScrollText,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short hint shown in the mobile drawer. */
  hint: string;
}

export const APP_NAV: AppNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    hint: "Overview of detected payments",
  },
  {
    href: "/receive",
    label: "Receive",
    icon: ArrowDownToLine,
    hint: "Share your stealth meta-address",
  },
  { href: "/send", label: "Send", icon: Send, hint: "Pay a stealth meta-address" },
  {
    href: "/activity",
    label: "Activity",
    icon: ScrollText,
    hint: "Full transaction history",
  },
  {
    href: "/identity",
    label: "Stealth Identity",
    icon: KeyRound,
    hint: "Viewing and spending keys",
  },
  {
    href: "/scanner",
    label: "Scanner",
    icon: Radar,
    hint: "Announcement scanning radar",
  },
  { href: "/settings", label: "Settings", icon: Settings, hint: "Network and security" },
];

/** Primary navigation for the public marketing site. */
export const MARKETING_NAV = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#features", label: "Features" },
  { href: "/#security", label: "Security" },
  { href: "/#avalanche", label: "Avalanche" },
];
