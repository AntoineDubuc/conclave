"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Play,
  History,
  Layers,
  Settings,
  Key,
  CreditCard,
  HelpCircle,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  userPlan?: "managed" | "byok";
  balance?: number;
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  byokOnly?: boolean;
  collapsed: boolean;
  isActive: boolean;
  userPlan: "managed" | "byok";
}

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Conclaves", icon: Layers },
  { href: "/flows/new", label: "New Flow", icon: Play },
  { href: "/runs", label: "History", icon: History },
];

const settingsNavItems = [
  { href: "/settings/profile", label: "Profile", icon: Settings },
  { href: "/settings/keys", label: "API Keys", icon: Key, byokOnly: true },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
];

function NavItem({ href, label, icon: Icon, byokOnly, collapsed, isActive, userPlan }: NavItemProps) {
  // Hide BYOK-only items for managed users
  if (byokOnly && userPlan === "managed") return null;

  const content = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-xl transition-all",
        "text-muted-foreground hover:text-foreground hover:bg-white/5",
        isActive && "text-foreground bg-white/10 border border-white/10"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="glass">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function Sidebar({ collapsed, onToggle, userPlan = "managed", balance }: SidebarProps) {
  const pathname = usePathname();

  const checkIsActive = (href: string) => {
    if (href === "/settings/profile") {
      return pathname === "/settings/profile";
    }
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen glass-card border-r border-white/10",
          "flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          {!collapsed && (
            <Link href="/dashboard" className="text-xl font-bold gradient-brand-text">
              Conclave
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {mainNavItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              collapsed={collapsed}
              isActive={checkIsActive(item.href)}
              userPlan={userPlan}
            />
          ))}

          <div className="pt-4 pb-2">
            {!collapsed && (
              <span className="px-3 text-caption">
                Settings
              </span>
            )}
          </div>

          {settingsNavItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              collapsed={collapsed}
              isActive={checkIsActive(item.href)}
              userPlan={userPlan}
            />
          ))}
        </nav>

        {/* Balance/Plan Card - Only show when not collapsed */}
        {!collapsed && (
          <div className="p-4 border-t border-white/10">
            <div className="glass rounded-xl p-3">
              {userPlan === "managed" ? (
                <>
                  <div className="text-xs text-muted-foreground mb-1">Balance</div>
                  <div className="text-lg font-bold">${balance?.toFixed(2) ?? "0.00"}</div>
                  <Link
                    href="/settings/billing"
                    className="text-xs text-primary hover:underline"
                  >
                    Add funds
                  </Link>
                </>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-1">Plan</div>
                  <div className="text-lg font-bold">BYOK</div>
                  <div className="text-xs text-muted-foreground">$10/month</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Help Link */}
        <div className="p-3 border-t border-white/10">
          <NavItem
            href="/docs"
            label="Help & Docs"
            icon={HelpCircle}
            collapsed={collapsed}
            isActive={checkIsActive("/docs")}
            userPlan={userPlan}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
