import { useEffect, useRef, useState } from "react";

import { CoinMetadata } from "@mysten/sui/client";
import BigNumber from "bignumber.js";

import { useSettingsContext } from "../contexts";
import { getCoinMetadataMap } from "../lib/coinMetadata";

const useBalancesCoinMetadataMap = (
  rawBalancesMap: Record<string, BigNumber> | undefined,
) => {
  const { suiClient } = useSettingsContext();

  const coinTypesBeingFetchesRef = useRef<string[]>([]);
  const [balancesCoinMetadataMap, setBalancesCoinMetadataMap] = useState<
    Record<string, CoinMetadata> | undefined
  >(undefined);

  useEffect(() => {
    (async () => {
      const coinTypes = Object.keys(rawBalancesMap ?? {}).filter(
        (coinType) => !coinTypesBeingFetchesRef.current.includes(coinType),
      );
      if (coinTypes.length === 0) return;

      coinTypesBeingFetchesRef.current.push(...coinTypes);

      const _coinMetadataMap = await getCoinMetadataMap(suiClient, coinTypes);
      setBalancesCoinMetadataMap((prev) => ({
        ...(prev ?? {}),
        ..._coinMetadataMap,
      }));
    })();
  }, [rawBalancesMap, suiClient]);

  return balancesCoinMetadataMap;
};

export default useBalancesCoinMetadataMap;
