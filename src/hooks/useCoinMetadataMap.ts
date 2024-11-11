import { useEffect, useRef, useState } from "react";

import { CoinMetadata } from "@mysten/sui/client";

import { useSettingsContext } from "../contexts";
import { getCoinMetadataMap } from "../lib/coinMetadata";

const useCoinMetadataMap = (coinTypes: string[]) => {
  const { suiClient } = useSettingsContext();

  const coinTypesBeingFetchedRef = useRef<string[]>([]);
  const [coinMetadataMap, setCoinMetadataMap] = useState<
    Record<string, CoinMetadata> | undefined
  >(undefined);

  useEffect(() => {
    (async () => {
      const filteredCoinTypes = Array.from(new Set(coinTypes)).filter(
        (coinType) => !coinTypesBeingFetchedRef.current.includes(coinType),
      );
      if (filteredCoinTypes.length === 0) return;

      coinTypesBeingFetchedRef.current.push(...filteredCoinTypes);

      const _coinMetadataMap = await getCoinMetadataMap(
        suiClient,
        filteredCoinTypes,
      );
      setCoinMetadataMap((prev) => ({
        ...(prev ?? {}),
        ..._coinMetadataMap,
      }));
    })();
  }, [coinTypes, suiClient]);

  return coinMetadataMap;
};

export default useCoinMetadataMap;
