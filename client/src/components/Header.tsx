import { Link, useLocation } from "wouter";
import { Search, Wallet, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useAuth } from "@/lib/AuthContext";
import pokeBallPath from "@assets/Poke_Ball_1763685472245.webp";

export default function Header() {
  const [location] = useLocation();
  const isVisible = useScrollDirection();
  const { user, logout } = useAuth();

  const isAuthPage = location === "/login" || location === "/signup";

  return (
    <header className={`sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-transform duration-300 ${isVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="container flex flex-col items-center max-w-7xl mx-auto px-4 py-4 gap-3">
        <div className="flex items-center justify-between w-full">
          <Link href="/">
            <div className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-md px-3 py-2 cursor-pointer">
              <img src={pokeBallPath} alt="Poké Ball" className="h-10 w-10" />
              <div className="flex flex-col">
                <div className="text-4xl font-bold text-primary" style={{ fontFamily: 'var(--font-pokemon)' }}>
                  PokéPortfolio
                </div>
                <div className="text-xs text-muted-foreground">by Nkinnas</div>
              </div>
            </div>
          </Link>

          {user && !isAuthPage && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" data-testid="text-username">
                Welcome, {user.username}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="gap-2"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          )}
        </div>

        {!isAuthPage && (
          <nav className="flex items-center gap-0 w-full justify-center">
            <Link href="/" className="flex-1">
              <Button
                variant={location === "/" ? "default" : "ghost"}
                size="lg"
                className={`gap-2 w-full relative ${location !== "/" ? "bg-muted text-muted-foreground" : ""}`}
                style={{ 
                  clipPath: 'polygon(100% 0%, 10% 0%, 0% 100%, 90% 100%)',
                  padding: '0.75rem 1.5rem 0.75rem 2rem'
                }}
                data-testid="link-search"
              >
                <Search className="h-5 w-5" />
                Search
              </Button>
            </Link>
            <Link href="/portfolio" className="flex-1">
              <Button
                variant={location === "/portfolio" ? "default" : "ghost"}
                size="lg"
                className={`gap-2 w-full relative ${location !== "/portfolio" ? "bg-muted text-muted-foreground" : ""}`}
                style={{ 
                  clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
                  padding: '0.75rem 1.5rem 0.75rem 2rem'
                }}
                data-testid="link-portfolio"
              >
                <Wallet className="h-5 w-5" />
                Portfolio
              </Button>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
