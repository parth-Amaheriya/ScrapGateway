import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, KeyRound, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMut = useMutation({
    mutationFn: authApi.logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate({ to: "/docs", replace: true });
    },
  });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/projects" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-foreground leading-none">QuotaKey</p>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/projects"
            activeOptions={{ exact: true }}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
          >
            Projects
          </Link>
          <Link
            to="/projects/new"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
          >
            Create
          </Link>
          <Link
            to="/issues"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
          >
            <AlertTriangle className="h-4 w-4" />
            Issues
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {authQuery.data?.authenticated ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => logoutMut.mutate()}
              disabled={logoutMut.isPending}
            >
              <LogOut className="h-4 w-4" />
              {logoutMut.isPending ? "Signing out..." : "Logout"}
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">
                <ShieldCheck className="h-4 w-4" />
                Login
              </Link>
            </Button>
          )}
          {/* <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
            <UserCircle2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-foreground hidden sm:inline">
              {authQuery.data?.authenticated ? "Admin" : "Public"}
            </span>
          </div> */}
        </div>
      </div>
    </header>
  );
}
