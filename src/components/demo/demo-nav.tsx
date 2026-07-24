"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, LayoutDashboard, MessageSquare, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/demo", label: "Projects", icon: FolderKanban },
  { href: "/demo/views", label: "Views", icon: LayoutDashboard },
  { href: "/demo/chat", label: "Chat", icon: MessageSquare },
  { href: "/demo/audit", label: "Audit", icon: ScrollText },
];

export function DemoNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/demo" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
