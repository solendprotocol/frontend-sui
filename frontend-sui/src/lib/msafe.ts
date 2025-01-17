export const isInMsafeApp = () =>
  typeof window !== "undefined" &&
  window?.location?.ancestorOrigins &&
  Array.from(window.location.ancestorOrigins).length > 0 &&
  Array.from(window.location.ancestorOrigins)[0]?.includes("m-safe.io");

export const getMsafeBaseUrl = () =>
  Array.from(window.location.ancestorOrigins)[0];
export const getMsafeAppStoreUrl = (appName: string) =>
  `${getMsafeBaseUrl()}/store/${appName}`;
