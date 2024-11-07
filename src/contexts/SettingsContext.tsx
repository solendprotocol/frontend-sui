import { PropsWithChildren, createContext, useContext, useMemo } from "react";

import { useLocalStorage } from "usehooks-ts";

import {
  EXPLORERS,
  Explorer,
  ExplorerId,
  RPCS,
  Rpc,
  RpcId,
} from "@/lib/constants";

interface SettingsContext {
  rpc: Rpc;
  setRpcId: (id: RpcId) => void;
  setRpcUrl: (url: string) => void;

  explorer: Explorer;
  setExplorerId: (id: ExplorerId) => void;

  gasBudget: string;
  setGasBudget: (value: string) => void;
}

const defaultContextValue: SettingsContext = {
  rpc: RPCS[0],
  setRpcId: () => {
    throw Error("SettingsContextProvider not initialized");
  },
  setRpcUrl: () => {
    throw Error("SettingsContextProvider not initialized");
  },

  explorer: EXPLORERS[0],
  setExplorerId: () => {
    throw Error("SettingsContextProvider not initialized");
  },

  gasBudget: "",
  setGasBudget: () => {
    throw Error("SettingsContextProvider not initialized");
  },
};

const SettingsContext = createContext<SettingsContext>(defaultContextValue);

export const useSettingsContext = () => useContext(SettingsContext);

export function SettingsContextProvider({ children }: PropsWithChildren) {
  // RPC
  const [rpcId, setRpcId] = useLocalStorage<RpcId>(
    "rpcId",
    defaultContextValue.rpc.id,
  );
  const [rpcUrl, setRpcUrl] = useLocalStorage<string>("rpcUrl", "");

  const customRpc = RPCS.find((_rpc) => _rpc.id === rpcId) as Rpc;
  const rpc = useMemo(
    () =>
      rpcUrl
        ? { ...customRpc, url: rpcUrl }
        : (RPCS.find((_rpc) => _rpc.id === rpcId) ?? RPCS[0]),
    [customRpc, rpcUrl, rpcId],
  );

  // Explorer
  const [explorerId, setExplorerId] = useLocalStorage<ExplorerId>(
    "explorerId",
    defaultContextValue.explorer.id,
  );
  const explorer = useMemo(
    () =>
      EXPLORERS.find((_explorer) => _explorer.id === explorerId) ??
      EXPLORERS[0],
    [explorerId],
  );

  // Gas budget
  const [gasBudget, setGasBudget] = useLocalStorage<string>(
    "gasBudget",
    defaultContextValue.gasBudget,
  );

  // Context
  const contextValue: SettingsContext = useMemo(
    () => ({
      rpc,
      setRpcId,
      setRpcUrl,

      explorer,
      setExplorerId,

      gasBudget,
      setGasBudget,
    }),
    [
      rpc,
      setRpcId,
      setRpcUrl,
      explorer,
      setExplorerId,
      gasBudget,
      setGasBudget,
    ],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}
