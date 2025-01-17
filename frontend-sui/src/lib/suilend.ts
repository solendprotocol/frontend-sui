import { CoinMetadata, SuiClient } from "@mysten/sui/client";
import { normalizeStructTag } from "@mysten/sui/utils";
import { SuiPriceServiceConnection } from "@pythnetwork/pyth-sui-js";
import BigNumber from "bignumber.js";

import { SuilendClient } from "@suilend/sdk/client";
import { WAD } from "@suilend/sdk/constants";
import { parseLendingMarket } from "@suilend/sdk/parsers/lendingMarket";
import {
  ParsedObligation,
  parseObligation,
} from "@suilend/sdk/parsers/obligation";
import { ParsedReserve } from "@suilend/sdk/parsers/reserve";
import * as simulate from "@suilend/sdk/utils/simulate";

import { getPrice } from "./api";
import { getCoinMetadataMap } from "./coinMetadata";
import {
  NORMALIZED_MAYA_COINTYPE,
  RESERVES_CUSTOM_ORDER,
  TEMPORARY_PYTH_PRICE_FEED_COINTYPES,
  isSendPoints,
} from "./coinType";
import { formatRewards } from "./liquidityMining";

export const initializeSuilend = async (
  suiClient: SuiClient,
  suilendClient: SuilendClient,
  address?: string,
) => {
  const now = Math.floor(Date.now() / 1000);

  const refreshedRawReserves = await simulate.refreshReservePrice(
    suilendClient.lendingMarket.reserves.map((r) =>
      simulate.compoundReserveInterest(r, now),
    ),
    new SuiPriceServiceConnection("https://hermes.pyth.network"),
  );

  const reserveCoinTypes: string[] = [];
  const rewardCoinTypes: string[] = [];
  refreshedRawReserves.forEach((r) => {
    reserveCoinTypes.push(normalizeStructTag(r.coinType.name));

    [
      ...r.depositsPoolRewardManager.poolRewards,
      ...r.borrowsPoolRewardManager.poolRewards,
    ].forEach((pr) => {
      if (!pr) return;

      rewardCoinTypes.push(normalizeStructTag(pr.coinType.name));
    });
  });
  const uniqueReservesCoinTypes = Array.from(new Set(reserveCoinTypes));
  const uniqueRewardsCoinTypes = Array.from(new Set(rewardCoinTypes));

  const reserveCoinMetadataMap = await getCoinMetadataMap(
    suiClient,
    uniqueReservesCoinTypes,
  );
  const rewardCoinMetadataMap = await getCoinMetadataMap(
    suiClient,
    uniqueRewardsCoinTypes,
  );
  const coinMetadataMap = {
    ...reserveCoinMetadataMap,
    ...rewardCoinMetadataMap,
  };

  const reservesWithTemporaryPythPriceFeeds = refreshedRawReserves.filter((r) =>
    TEMPORARY_PYTH_PRICE_FEED_COINTYPES.includes(
      normalizeStructTag(r.coinType.name),
    ),
  );
  for (const reserve of reservesWithTemporaryPythPriceFeeds) {
    const birdeyePrice = await getPrice(
      normalizeStructTag(reserve.coinType.name),
    );
    if (birdeyePrice === undefined) continue;

    const parsedBirdeyePrice = BigInt(
      +new BigNumber(birdeyePrice)
        .times(WAD)
        .integerValue(BigNumber.ROUND_DOWN),
    );
    (reserve.price.value as bigint) = parsedBirdeyePrice;
    (reserve.smoothedPrice.value as bigint) = parsedBirdeyePrice;
  }

  const lendingMarket = parseLendingMarket(
    suilendClient.lendingMarket,
    refreshedRawReserves,
    coinMetadataMap,
    now,
  );
  lendingMarket.reserves = lendingMarket.reserves.slice().sort((a, b) => {
    const aCustomOrderIndex = RESERVES_CUSTOM_ORDER.indexOf(a.coinType);
    const bCustomOrderIndex = RESERVES_CUSTOM_ORDER.indexOf(b.coinType);

    if (aCustomOrderIndex > -1 && bCustomOrderIndex > -1)
      return aCustomOrderIndex - bCustomOrderIndex;
    else if (aCustomOrderIndex === -1 && bCustomOrderIndex === -1) return 0;
    else return aCustomOrderIndex > -1 ? -1 : 1;
  });

  const reserveMap = lendingMarket.reserves.reduce(
    (acc, reserve) => ({ ...acc, [reserve.coinType]: reserve }),
    {},
  ) as Record<string, ParsedReserve>;

  // Obligations
  let obligationOwnerCaps, obligations;
  if (address) {
    obligationOwnerCaps = await SuilendClient.getObligationOwnerCaps(
      address,
      suilendClient.lendingMarket.$typeArgs,
      suiClient,
    );

    obligations = (
      await Promise.all(
        obligationOwnerCaps.map((ownerCap) =>
          SuilendClient.getObligation(
            ownerCap.obligationId,
            suilendClient.lendingMarket.$typeArgs,
            suiClient,
          ),
        ),
      )
    )
      .map((rawObligation) =>
        simulate.refreshObligation(rawObligation, refreshedRawReserves),
      )
      .map((refreshedObligation) =>
        parseObligation(refreshedObligation, reserveMap),
      )
      .sort((a, b) => +b.netValueUsd.minus(a.netValueUsd));
  }

  return {
    lendingMarket,
    refreshedRawReserves,
    reserveMap,

    reserveCoinTypes: uniqueReservesCoinTypes,
    rewardCoinTypes: uniqueRewardsCoinTypes,

    reserveCoinMetadataMap,
    rewardCoinMetadataMap,
    coinMetadataMap,

    obligationOwnerCaps,
    obligations,
  };
};

export const initializeSuilendRewards = async (
  reserveMap: Record<string, ParsedReserve>,
  rewardCoinTypes: string[],
  rewardCoinMetadataMap: Record<string, CoinMetadata>,
  obligations?: ParsedObligation[],
) => {
  const rewardPriceMap: Record<string, BigNumber | undefined> = Object.entries(
    reserveMap,
  ).reduce(
    (acc, [coinType, reserve]) => ({ ...acc, [coinType]: reserve.price }),
    {},
  );

  const reservelessRewardCoinTypes = rewardCoinTypes.filter(
    (coinType) =>
      !isSendPoints(coinType) &&
      coinType !== NORMALIZED_MAYA_COINTYPE &&
      !reserveMap[coinType],
  );
  const reservelessRewardBirdeyePrices = await Promise.all(
    reservelessRewardCoinTypes.map((coinType) => getPrice(coinType)),
  );
  for (let i = 0; i < reservelessRewardCoinTypes.length; i++) {
    const birdeyePrice = reservelessRewardBirdeyePrices[i];
    if (birdeyePrice === undefined) continue;

    rewardPriceMap[reservelessRewardCoinTypes[i]] = new BigNumber(birdeyePrice);
  }

  const rewardMap = formatRewards(
    reserveMap,
    rewardCoinMetadataMap,
    rewardPriceMap,
    obligations,
  );

  return { rewardPriceMap, rewardMap };
};
