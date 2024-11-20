import { CoinMetadata, SuiClient } from "@mysten/sui/client";

import { extractCTokenCoinType, isCTokenCoinType } from "@suilend/sdk";

import {
  COINTYPE_LOGO_MAP,
  COINTYPE_SYMBOL_MAP,
  extractSymbolFromCoinType,
} from "./coinType";

export const getCoinMetadataMap = async (
  suiClient: SuiClient,
  uniqueCoinTypes: string[], // Assumed already normalized
) => {
  if (uniqueCoinTypes.length === 0) return {};

  try {
    const coinMetadata = await Promise.all(
      uniqueCoinTypes.map((coinType) =>
        suiClient.getCoinMetadata({
          coinType: isCTokenCoinType(coinType)
            ? extractCTokenCoinType(coinType)
            : coinType,
        }),
      ),
    );

    const coinMetadataMap: Record<string, CoinMetadata> = {};
    for (let i = 0; i < uniqueCoinTypes.length; i++) {
      const metadata = coinMetadata[i];
      if (!metadata) continue;

      const coinType = uniqueCoinTypes[i];

      coinMetadataMap[coinType] = {
        ...metadata,
        iconUrl:
          COINTYPE_LOGO_MAP[
            isCTokenCoinType(coinType)
              ? extractCTokenCoinType(coinType)
              : coinType
          ] ?? metadata.iconUrl,
        symbol:
          COINTYPE_SYMBOL_MAP[
            isCTokenCoinType(coinType)
              ? extractCTokenCoinType(coinType)
              : coinType
          ] ??
          metadata.symbol ??
          extractSymbolFromCoinType(coinType),
      };
    }

    return coinMetadataMap;
  } catch (err) {
    console.error(err);
    return {};
  }
};

export type Token = CoinMetadata & {
  coinType: string;
};

export const getToken = (coinType: string, coinMetadata: CoinMetadata) => ({
  coinType,
  ...coinMetadata,
});
