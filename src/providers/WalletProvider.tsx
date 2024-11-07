import { PropsWithChildren, useEffect, useRef } from "react";

import { MSafeWallet } from "@msafe/sui-wallet";
import {
  WalletProvider as MystenWalletProvider,
  SuiClientProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import { registerWallet } from "@mysten/wallet-standard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useSettingsContext } from "@/contexts/SettingsContext";
import { DEFAULT_EXTENSION_WALLET_NAMES } from "@/contexts/WalletContext";

interface WalletProviderProps extends PropsWithChildren {
  appName: string;
}

export default function WalletProvider({
  appName,
  children,
}: WalletProviderProps) {
  const { rpc } = useSettingsContext();

  const { networkConfig } = createNetworkConfig({
    mainnet: { url: rpc.url },
  });
  const queryClient = new QueryClient();

  // MSafe Wallet
  const didRegisterMsafeWalletRef = useRef<boolean>(false);
  useEffect(() => {
    if (didRegisterMsafeWalletRef.current) return;

    registerWallet(new MSafeWallet(appName, rpc.url, "sui:mainnet"));
    didRegisterMsafeWalletRef.current = true;
  }, [appName, rpc.url]);

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
        <MystenWalletProvider
          preferredWallets={DEFAULT_EXTENSION_WALLET_NAMES}
          autoConnect
          stashedWallet={{ name: appName }}
        >
          {children}
        </MystenWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
