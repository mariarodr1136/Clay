"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Menu,
  Plug,
  ScrollText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Projects", icon: FolderKanban },
  { href: "/views", label: "Views", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/audit", label: "Audit", icon: ScrollText },
  { href: "/settings", label: "Connect", icon: Plug },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Below `sm` the horizontal nav doesn't fit beside the logo and workspace
// badge, so it used to be hidden outright — which left a phone with no way to
// reach Views, Chat, Audit or Connect at all, short of guessing that the
// search button also navigates. Same destinations, collapsed into a menu.
function MobileNav({ pathname }: { pathname: string }) {
  const current = navItems.find((item) => isActive(pathname, item.href));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open navigation menu"
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:hidden"
      >
        <Menu className="size-4" />
        {/* Naming the section you're in makes the collapsed menu as
            orientating as the expanded nav it replaces. */}
        {current?.label ?? "Menu"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {navItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2",
                isActive(pathname, item.href) && "text-foreground font-medium"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <MobileNav pathname={pathname} />
      <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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
    </>
  );
}
