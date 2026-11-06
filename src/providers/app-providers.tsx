"use client";

import { ToastProvider } from "@/components/ui/toast";
import { WalletProvider } from "@/providers/wallet-provider";
import { StealthIdentityProvider } from "@/providers/stealth-identity-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WalletProvider>
        {/* Holds the session stealth identity; depends on the wallet's chain. */}
        <StealthIdentityProvider>{children}</StealthIdentityProvider>
      </WalletProvider>
    </ToastProvider>
  );
}
