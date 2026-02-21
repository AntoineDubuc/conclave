"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Play, History, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/flows/new", label: "New", icon: Play },
  { href: "/runs", label: "History", icon: History },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/settings/profile") {
      return pathname.startsWith("/settings");
    }
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-nav border-t border-white/10">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-2 rounded-xl transition-all",
              "text-muted-foreground hover:text-foreground",
              isActive(href) && "text-foreground"
            )}
          >
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all",
                isActive(href) && "bg-gradient-to-r from-indigo-500/20 to-purple-500/20"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-[10px] mt-1 font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
