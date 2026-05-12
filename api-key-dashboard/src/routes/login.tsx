import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { authApi, isUnauthorizedError } from "@/api/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo:
      typeof search.returnTo === "string" && search.returnTo.startsWith("/")
        ? search.returnTo
        : "/projects",
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [formError, setFormError] = useState<string | null>(null);

  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (authQuery.data?.authenticated) {
      navigate({ to: search.returnTo, replace: true });
    }
  }, [authQuery.data, navigate, search.returnTo]);

  const loginMut = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => {
      toast.success("Admin login successful");
      authQuery.refetch(); // Refetch auth status to trigger navigation via useEffect
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  if (authQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader label="Checking session..." />
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const formData = new FormData(event.currentTarget);
    loginMut.mutate({
      username: String(formData.get("username") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_36%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4">
      <Card className="w-full max-w-md border-border/60 shadow-xl backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Admin login</CardTitle>
            <CardDescription>
              Sign in to access projects, issues, and dashboard controls.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" placeholder="admin" autoComplete="username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <Button className="w-full" type="submit" disabled={loginMut.isPending}>
              {loginMut.isPending ? "Signing in..." : "Sign in"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Public documentation is still available <Link to="/badger/docs" className="font-medium text-foreground underline-offset-4 hover:underline">here</Link>.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}