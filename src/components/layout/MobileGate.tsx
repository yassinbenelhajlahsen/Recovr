"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const MOBILE_ALLOWED = ["/", "/mobile", "/privacy", "/terms-of-service"];
const MOBILE_BREAKPOINT = 768;

function isMobileAllowed(pathname: string): boolean {
  return MOBILE_ALLOWED.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export function MobileGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isMobileAllowed(pathname)) return;

    function check() {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        router.replace("/mobile");
      }
    }

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [pathname, router]);

  return null;
}
