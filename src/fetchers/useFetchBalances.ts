import { normalizeStructTag } from "@mysten/sui/utils";
import BigNumber from "bignumber.js";
import useSWR from "swr";

import { useSettingsContext } from "../contexts/SettingsContext";
import { useWalletContext } from "../contexts/WalletContext";
import { showErrorToast } from "../lib";

export default function useFetchBalances() {
  const { suiClient } = useSettingsContext();
  const { address } = useWalletContext();

  const dataFetcher = async () => {
    const balancesMap: Record<string, BigNumber> = {};

    if (address) {
      const rawBalances = (
        await suiClient.getAllBalances({
          owner: address,
        })
      )
        .map((cb) => ({ ...cb, coinType: normalizeStructTag(cb.coinType) }))
        .sort((a, b) => (a.coinType < b.coinType ? -1 : 1));

      for (const rawBalance of rawBalances) {
        balancesMap[rawBalance.coinType] = new BigNumber(
          rawBalance.totalBalance,
        );
      }
    }

    return balancesMap;
  };

  const { data, mutate } = useSWR<Record<string, BigNumber>>(
    `balances-${address}`,
    dataFetcher,
    {
      refreshInterval: 15 * 1000,
      onSuccess: (data) => {
        console.log("Refreshed wallet balances", data);
      },
      onError: (err) => {
        showErrorToast("Failed to refresh wallet balances", err);
        console.error(err);
      },
    },
  );

  return { data, mutateData: mutate };
}
