import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { authApi, isUnauthorizedError } from "@/api/auth";
import { Loader } from "@/components/Loader";
import type { ReactNode } from "react";

export function AdminGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (authQuery.isError && isUnauthorizedError(authQuery.error)) {
      navigate({
        to: "/login",
        search: { returnTo: pathname },
        replace: true,
      });
    }
  }, [authQuery.error, authQuery.isError, navigate, pathname]);

  if (authQuery.isLoading) {
    return <Loader label="Checking admin access..." />;
  }

  if (authQuery.isError) {
    if (isUnauthorizedError(authQuery.error)) {
      return <Loader label="Redirecting to login..." />;
    }

    return <Loader label="Loading admin area..." />;
  }

  return <>{children}</>;
}