"use client";

import { SWRConfig } from "swr";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { swrFetcher } from "@/lib/fetch";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-center" richColors duration={1500}/>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        errorRetryCount: 2,
      }}
    >
      <ThemeProvider>
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </SWRConfig>
  );
}
