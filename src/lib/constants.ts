export const msPerYear = 31556952000; // Approx. 1000 * 60 * 60 * 24 * 365;

export const TOAST_DURATION_MS = 4 * 1000;
export const TX_TOAST_DURATION_MS = 10 * 1000;

export const SUI_GAS_MIN = 0.05;

export enum RpcId {
  TRITON_ONE = "tritonOne",
  FULL_NODE = "fullNode",
  ALL_THAT_NODE = "allThatNode",
  CUSTOM = "custom",
}

export type Rpc = {
  id: RpcId;
  name: string;
  url: string;
};

export const RPCS: Rpc[] = [
  {
    id: RpcId.TRITON_ONE,
    name: "Triton One",
    url: `https://solendf-suishar-0c55.mainnet.sui.rpcpool.com/${
      process.env.NEXT_PUBLIC_SUI_TRITON_ONE_DEV_API_KEY ?? ""
    }`,
  },
  {
    id: RpcId.FULL_NODE,
    name: "Full Node",
    url: "https://fullnode.mainnet.sui.io:443",
  },
  {
    id: RpcId.ALL_THAT_NODE,
    name: "All That Node",
    url: "https://sui-mainnet-rpc.allthatnode.com",
  },
  {
    id: RpcId.CUSTOM,
    name: "Custom",
    url: "",
  },
];

export enum ExplorerId {
  SUI_SCAN = "suiScan",
  SUI_VISION = "suiVision",
}

export type Explorer = {
  id: ExplorerId;
  name: string;
  buildAddressUrl: (address: string) => string;
  buildObjectUrl: (id: string) => string;
  buildCoinUrl: (coinType: string) => string;
  buildTxUrl: (digest: string) => string;
};

export const EXPLORERS: Explorer[] = [
  {
    id: ExplorerId.SUI_SCAN,
    name: "Suiscan",
    buildAddressUrl: (address: string) =>
      `https://suiscan.xyz/mainnet/account/${address}`,
    buildObjectUrl: (id: string) => `https://suiscan.xyz/mainnet/object/${id}`,
    buildCoinUrl: (coinType: string) =>
      `https://suiscan.xyz/mainnet/coin/${coinType}`,
    buildTxUrl: (digest: string) => `https://suiscan.xyz/mainnet/tx/${digest}`,
  },
  {
    id: ExplorerId.SUI_VISION,
    name: "SuiVision",
    buildAddressUrl: (address: string) =>
      `https://suivision.xyz/account/${address}`,
    buildObjectUrl: (id: string) => `https://suivision.xyz/object/${id}`,
    buildCoinUrl: (coinType: string) =>
      `https://suivision.xyz/coin/${coinType}`,
    buildTxUrl: (digest: string) => `https://suivision.xyz/txblock/${digest}`,
  },
];
