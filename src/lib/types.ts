import { CoinMetadata } from "@mysten/sui/client";

export type Token = CoinMetadata & {
  coinType: string;
};
