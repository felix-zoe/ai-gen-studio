import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Image,
  Video,
  History,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/providers/AuthProvider";

const NAV_ITEMS = [
  { to: "/generate/image", label: "图片生成", icon: Image },
  { to: "/generate/video", label: "视频生成", icon: Video },
  { to: "/history", label: "历史记录", icon: History },
  { to: "/settings", label: "设置", icon: Settings },
];

/* Brand Logo SVG — abstract sparkle/generation icon in indigo-violet */
function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Central diamond shape */}
      <path
        d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Small accent dot */}
      <circle cx="18" cy="5" r="1.5" fill="currentColor" opacity="0.5" />
      <circle cx="6" cy="18" r="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/* Page title mapping */
const PAGE_TITLES: Record<string, string> = {
  "/generate/image": "图片生成",
  "/generate/video": "视频生成",
  "/history": "历史记录",
  "/settings": "设置",
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentPageTitle =
    PAGE_TITLES[location.pathname] || "AI Gen Studio";
  const userInitial = user?.email?.charAt(0).toUpperCase() || "U";

  const navContent = (item: (typeof NAV_ITEMS)[number], isActive: boolean) => (
    <>
      {/* Active indicator bar */}
      {isActive && (
        <span className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-primary",
          collapsed ? "h-7 w-[3px]" : "h-5 w-[2px]",
        )} />
      )}
      <div className={cn(
        "flex items-center justify-center rounded-md",
        collapsed && "h-9 w-9",
        isActive && collapsed && "bg-primary/[0.12]",
      )}>
        <item.icon className={cn(
          "shrink-0",
          collapsed ? "h-[18px] w-[18px]" : "h-[18px] w-[18px]",
          isActive && collapsed && "text-primary",
        )} />
      </div>
      {!collapsed && (
        <span className="text-[14px] font-medium leading-none">
          {item.label}
        </span>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "relative flex flex-col bg-surface-1 transition-all duration-200 ease-in-out",
          "border-r border-[hsl(var(--border-light))]",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {/* Brand area */}
        <div className={cn("flex items-center shrink-0", collapsed ? "h-[68px] justify-center px-3" : "h-14 justify-between px-3")}>
          <div className={cn("flex items-center gap-2.5 min-w-0", collapsed && "justify-center")}>
            <BrandLogo
              className={cn(
                "h-7 w-7 shrink-0 text-primary transition-transform duration-200",
                !collapsed && "ml-1",
              )}
            />
            {!collapsed && (
              <span
                className="text-[14px] font-semibold tracking-[-0.3px] text-foreground whitespace-nowrap"
              >
                AI Gen Studio
              </span>
            )}
          </div>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setCollapsed(true)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className={cn("relative h-px bg-[hsl(var(--border-light))]", collapsed ? "mx-0" : "mx-3")}>
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[hsl(var(--border-light))] bg-background text-muted-foreground hover:text-foreground shadow-xs transition-colors"
            >
              <PanelLeft className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 px-2 pb-3 space-y-0.5 overflow-hidden", collapsed ? "pt-4" : "pt-3")}>
          {NAV_ITEMS.map((item) => {
            const NavElement = (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] font-medium transition-all duration-150",
                    collapsed ? "justify-center px-2" : "",
                    isActive
                      ? collapsed
                        ? "text-primary"
                        : "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                      : "text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => navContent(item, isActive)}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.to} delayDuration={0}>
                  <TooltipTrigger asChild>{NavElement}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return NavElement;
          })}
        </nav>

        {/* Bottom divider */}
        <div className="mx-3 h-px bg-[hsl(var(--border-light))]" />

        {/* User area */}
        <div className="p-2 shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground leading-tight">
                  {user?.email?.split("@")[0]}
                </div>
                <div className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {user?.email?.split("@")[1]}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white hover:bg-primary/90"
                  onClick={handleLogout}
                >
                  {userInitial}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <div className="text-[12px]">{user?.email}</div>
                <div className="text-[11px] text-muted-foreground">点击退出登录</div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center border-b border-[hsl(var(--border-light))] px-8">
          <h1 className="text-[15px] font-semibold text-foreground tracking-[-0.01em]">
            {currentPageTitle}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
