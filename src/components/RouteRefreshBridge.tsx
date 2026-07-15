"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTE_REFRESH_EVENT } from "@/lib/client/route-refresh";

export function RouteRefreshBridge() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(ROUTE_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(ROUTE_REFRESH_EVENT, refresh);
  }, [router]);

  return null;
}
