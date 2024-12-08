import { SUI_COINTYPE, isSui } from "./coinType";

export const getPrice = async (
  coinType: string,
): Promise<number | undefined> => {
  try {
    const url = `https://api.suilend.fi/proxy/price?${new URLSearchParams({
      address: isSui(coinType) ? SUI_COINTYPE : coinType,
    })}`;
    const res = await fetch(url);
    const json = await res.json();

    return +json.data.value;
  } catch (err) {
    console.error(err);
    return undefined;
  }
};

export const getHistoryPrice = async (
  coinType: string,
  interval: string,
  timeFromS: number,
  timeToS: number,
): Promise<{ timestampS: number; priceUsd: number }[] | undefined> => {
  try {
    const url = `https://api.suilend.fi/proxy/history-price?${new URLSearchParams(
      {
        address: isSui(coinType) ? SUI_COINTYPE : coinType,
        type: interval,
        time_from: `${timeFromS}`,
        time_to: `${timeToS}`,
      },
    )}`;
    const res = await fetch(url);
    const json = await res.json();

    return json.data.items.map((item: any) => ({
      timestampS: +item.unixTime,
      priceUsd: +item.value,
    }));
  } catch (err) {
    console.error(err);
    return undefined;
  }
};
