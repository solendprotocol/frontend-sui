import BigNumber from "bignumber.js";

export const fetchBirdeyePrice = async (coinType: string) => {
  try {
    const url = `https://public-api.birdeye.so/defi/price?address=${coinType}`;
    const res = await fetch(url, {
      headers: {
        "X-API-KEY": process.env.NEXT_PUBLIC_BIRDEYE_API_KEY as string,
        "x-chain": "sui",
      },
    });
    const json = await res.json();
    return new BigNumber(json.data.value);
  } catch (err) {
    console.error(err);
  }
};
