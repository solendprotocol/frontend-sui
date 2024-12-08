import { getHours, setHours, setMinutes, setSeconds } from "date-fns";

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
  let timeFrom = new Date(timeFromS * 1000);
  timeFrom = setHours(timeFrom, getHours(timeFrom) - (getHours(timeFrom) % 3));
  timeFrom = setMinutes(timeFrom, 0);
  timeFrom = setSeconds(timeFrom, 0);

  let timeTo = new Date(timeToS * 1000);
  timeTo = setHours(timeTo, getHours(timeTo) - (getHours(timeTo) % 3));
  timeTo = setMinutes(timeTo, 0);
  timeTo = setSeconds(timeTo, 0);

  const processedTimeFromS = Math.floor(timeFrom.getTime() / 1000);
  const processedTimeToS = Math.floor(timeTo.getTime() / 1000);

  try {
    const url = `https://api.suilend.fi/proxy/history-price?${new URLSearchParams(
      {
        address: isSui(coinType) ? SUI_COINTYPE : coinType,
        type: interval,
        time_from: `${processedTimeFromS}`,
        time_to: `${processedTimeToS}`,
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
