import { CoinMetadata } from "@mysten/sui/client";
import { Aftermath } from "aftermath-ts-sdk";
import BigNumber from "bignumber.js";

import { NORMALIZED_USDC_COINTYPE } from "./coinType";

export const fetchAftermathPrice = async (
  coinInType: string,
  coinInMetadata: CoinMetadata,
) => {
  try {
    const aftermathSdk = new Aftermath("MAINNET");
    aftermathSdk.init();

    const quote = await aftermathSdk
      .Router()
      .getCompleteTradeRouteGivenAmountIn({
        coinInType,
        coinOutType: NORMALIZED_USDC_COINTYPE,
        coinInAmount: BigInt(1 * 10 ** coinInMetadata.decimals),
      });

    const inAmount = new BigNumber(1);
    const outAmount = new BigNumber(quote.coinOut.amount.toString()).div(
      10 ** 6,
    );

    return outAmount.div(inAmount);
  } catch (err) {
    console.error(err);
    return undefined;
  }
};
