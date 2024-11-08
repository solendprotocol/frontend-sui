import { useEffect, useRef } from "react";

import { CoinBalance, SuiClient } from "@mysten/sui/client";
import { isEqual } from "lodash";

import { useWalletContext } from "../contexts";

const useRefreshOnBalancesChange = async (
  suiClient: SuiClient,
  refresh: () => Promise<void>,
) => {
  const { address } = useWalletContext();

  const previousBalancesRef = useRef<CoinBalance[] | undefined>(undefined);
  useEffect(() => {
    if (!address) return;

    previousBalancesRef.current = undefined;
    const interval = setInterval(async () => {
      try {
        const balances = await suiClient.getAllBalances({
          owner: address,
        });

        if (
          previousBalancesRef.current !== undefined &&
          !isEqual(balances, previousBalancesRef.current)
        )
          await refresh();

        previousBalancesRef.current = balances;
      } catch (err) {
        console.error(err);
      }
    }, 1000 * 5);

    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [address, suiClient, refresh]);
};

export default useRefreshOnBalancesChange;
