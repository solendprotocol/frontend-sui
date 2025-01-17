import { useRouter } from "next/router";
import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MSafeWallet } from "@msafe/sui-wallet";
import {
  WalletProvider as MystenWalletProvider,
  SuiClientProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import {
  useAccounts,
  useConnectWallet,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignTransaction,
  useSwitchAccount,
  useWallets,
} from "@mysten/dapp-kit";
import { SuiTransactionBlockResponse } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_DECIMALS } from "@mysten/sui/utils";
import { registerWallet } from "@mysten/wallet-standard";
import {
  WalletAccount,
  WalletIcon,
  WalletWithRequiredFeatures,
} from "@mysten/wallet-standard";
import * as Sentry from "@sentry/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { useLDClient } from "launchdarkly-react-client-sdk";
import { executeAuction } from "shio-sdk";

import { formatAddress, isInMsafeApp } from "@suilend/frontend-sui";

import { showErrorToast, showInfoToast } from "../lib";

import { useSettingsContext } from "./SettingsContext";

export enum WalletType {
  EXTENSION = "extension",
  WEB = "web",
}

type WalletPlatform = "iOS" | "android" | "extension";

export type Wallet = {
  name: string;
  isInstalled?: boolean; // Only if type is extension
  iconUrl?: WalletIcon;
  type: WalletType;
  downloadUrls?: Record<WalletPlatform, string | undefined>;
  raw?: WalletWithRequiredFeatures;
};

enum WalletName {
  SUI_WALLET = "Sui Wallet",
  NIGHTLY = "Nightly",
  SUIET = "Suiet",
  BYBIT_WALLET = "Bybit Wallet",
  GATE_WALLET = "Gate Wallet",
  OKX_WALLET = "OKX Wallet",

  MSAFE_WALLET = "MSafe Wallet",
  STASHED = "Stashed",
}

export const DEFAULT_EXTENSION_WALLET_NAMES = [
  WalletName.SUI_WALLET,
  WalletName.NIGHTLY,
  WalletName.SUIET,
  WalletName.BYBIT_WALLET,
  WalletName.GATE_WALLET,
  WalletName.OKX_WALLET,

  WalletName.MSAFE_WALLET,
];
const WEB_WALLET_NAMES = [WalletName.STASHED];

const WALLET_LOGO_MAP: Record<string, Wallet["iconUrl"]> = {
  [WalletName.SUI_WALLET]:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxyZWN0IHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0iIzRDQTNGRiIvPgogICAgPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xOC44MzI3IDEyLjM0MTNWMTIuMzQyMkMxOS42NDgyIDEzLjM2NTMgMjAuMTM2IDE0LjY2MTMgMjAuMTM2IDE2LjA3MDVDMjAuMTM2IDE3LjQ3OTggMTkuNjMzNyAxOC44MTQzIDE4Ljc5NTcgMTkuODQ0M0wxOC43MjM1IDE5LjkzM0wxOC43MDQ1IDE5LjgyMDNDMTguNjg4MiAxOS43MjQ1IDE4LjY2OSAxOS42Mjc1IDE4LjY0NyAxOS41M0MxOC4yMjc3IDE3LjY4NzUgMTYuODYxMiAxNi4xMDc1IDE0LjYxMjUgMTQuODI4MkMxMy4wOTQgMTMuOTY2OCAxMi4yMjQ3IDEyLjkyOTIgMTEuOTk2NSAxMS43NTA4QzExLjg0OSAxMC45ODg1IDExLjk1ODcgMTAuMjIzIDEyLjE3MDUgOS41NjcyNUMxMi4zODIyIDguOTExNzUgMTIuNjk3MiA4LjM2MjUgMTIuOTY0NyA4LjAzMkwxMy44Mzk1IDYuOTYyMjVDMTMuOTkzIDYuNzc0NzUgMTQuMjggNi43NzQ3NSAxNC40MzM1IDYuOTYyMjVMMTguODMzIDEyLjM0MTVMMTguODMyNyAxMi4zNDEzWk0yMC4yMTY1IDExLjI3MjVWMTEuMjcyTDE0LjM1MyA0LjEwMjc1QzE0LjI0MSAzLjk2NTc1IDE0LjAzMTUgMy45NjU3NSAxMy45MTk1IDQuMTAyNzVMOC4wNTYgMTEuMjcyM1YxMS4yNzI4TDguMDM3IDExLjI5NjVDNi45NTgyNSAxMi42MzUzIDYuMzEyNSAxNC4zMzY4IDYuMzEyNSAxNi4xODlDNi4zMTI1IDIwLjUwMjggOS44MTUyNSAyNCAxNC4xMzYzIDI0QzE4LjQ1NzIgMjQgMjEuOTYgMjAuNTAyOCAyMS45NiAxNi4xODlDMjEuOTYgMTQuMzM2OCAyMS4zMTQyIDEyLjYzNTMgMjAuMjM1MiAxMS4yOTYzTDIwLjIxNiAxMS4yNzI1SDIwLjIxNjVaTTkuNDU5MjUgMTIuMzE4TDkuOTgzNzUgMTEuNjc2NUw5Ljk5OTUgMTEuNzk1QzEwLjAxMiAxMS44ODg3IDEwLjAyNzIgMTEuOTgzIDEwLjA0NTIgMTIuMDc3OEMxMC4zODQ1IDEzLjg1ODIgMTEuNTk2NyAxNS4zNDI4IDEzLjYyMzUgMTYuNDkyNUMxNS4zODUyIDE3LjQ5NSAxNi40MTEgMTguNjQ4IDE2LjcwNjUgMTkuOTEyNUMxNi44Mjk4IDIwLjQ0MDMgMTYuODUxNyAyMC45NTk1IDE2Ljc5ODUgMjEuNDEzNUwxNi43OTUyIDIxLjQ0MTVMMTYuNzY5NyAyMS40NTRDMTUuOTc0NyAyMS44NDI1IDE1LjA4MDcgMjIuMDYwNSAxNC4xMzYgMjIuMDYwNUMxMC44MjI1IDIyLjA2MDUgOC4xMzYyNSAxOS4zNzg4IDguMTM2MjUgMTYuMDcwNUM4LjEzNjI1IDE0LjY1MDMgOC42MzE1IDEzLjM0NSA5LjQ1OSAxMi4zMTgzTDkuNDU5MjUgMTIuMzE4WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==",
  [WalletName.NIGHTLY]:
    "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAyOC4wLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iV2Fyc3R3YV8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCINCgkgdmlld0JveD0iMCAwIDg1MS41IDg1MS41IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA4NTEuNSA4NTEuNTsiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4NCgkuc3Qwe2ZpbGw6IzYwNjdGOTt9DQoJLnN0MXtmaWxsOiNGN0Y3Rjc7fQ0KPC9zdHlsZT4NCjxnPg0KCTxnIGlkPSJXYXJzdHdhXzJfMDAwMDAwMTQ2MDk2NTQyNTMxODA5NDY0NjAwMDAwMDg2NDc4NTIwMDIxMTY5MTg2ODhfIj4NCgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTEyNCwwaDYwMy42YzY4LjUsMCwxMjQsNTUuNSwxMjQsMTI0djYwMy42YzAsNjguNS01NS41LDEyNC0xMjQsMTI0SDEyNGMtNjguNSwwLTEyNC01NS41LTEyNC0xMjRWMTI0DQoJCQlDMCw1NS41LDU1LjUsMCwxMjQsMHoiLz4NCgk8L2c+DQoJPGcgaWQ9IldhcnN0d2FfMyI+DQoJCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik02MjMuNSwxNzAuM2MtMzcuNCw1Mi4yLTg0LjIsODguNC0xMzkuNSwxMTIuNmMtMTkuMi01LjMtMzguOS04LTU4LjMtNy44Yy0xOS40LTAuMi0zOS4xLDIuNi01OC4zLDcuOA0KCQkJYy01NS4zLTI0LjMtMTAyLjEtNjAuMy0xMzkuNS0xMTIuNmMtMTEuMywyOC40LTU0LjgsMTI2LjQtMi42LDI2My40YzAsMC0xNi43LDcxLjUsMTQsMTMyLjljMCwwLDQ0LjQtMjAuMSw3OS43LDguMg0KCQkJYzM2LjksMjkuOSwyNS4xLDU4LjcsNTEuMSw4My41YzIyLjQsMjIuOSw1NS43LDIyLjksNTUuNywyMi45czMzLjMsMCw1NS43LTIyLjhjMjYtMjQuNywxNC4zLTUzLjUsNTEuMS04My41DQoJCQljMzUuMi0yOC4zLDc5LjctOC4yLDc5LjctOC4yYzMwLjYtNjEuNCwxNC0xMzIuOSwxNC0xMzIuOUM2NzguMywyOTYuNyw2MzQuOSwxOTguNyw2MjMuNSwxNzAuM3ogTTI1My4xLDQxNC44DQoJCQljLTI4LjQtNTguMy0zNi4yLTEzOC4zLTE4LjMtMjAxLjVjMjMuNyw2MCw1NS45LDg2LjksOTQuMiwxMTUuM0MzMTIuOCwzNjIuMywyODIuMywzOTQuMSwyNTMuMSw0MTQuOHogTTMzNC44LDUxNy41DQoJCQljLTIyLjQtOS45LTI3LjEtMjkuNC0yNy4xLTI5LjRjMzAuNS0xOS4yLDc1LjQtNC41LDc2LjgsNDAuOUMzNjAuOSw1MTQuNywzNTMsNTI1LjQsMzM0LjgsNTE3LjV6IE00MjUuNyw2NzguNw0KCQkJYy0xNiwwLTI5LTExLjUtMjktMjUuNnMxMy0yNS42LDI5LTI1LjZzMjksMTEuNSwyOSwyNS42QzQ1NC43LDY2Ny4zLDQ0MS43LDY3OC43LDQyNS43LDY3OC43eiBNNTE2LjcsNTE3LjUNCgkJCWMtMTguMiw4LTI2LTIuOC00OS43LDExLjVjMS41LTQ1LjQsNDYuMi02MC4xLDc2LjgtNDAuOUM1NDMuOCw0ODgsNTM5LDUwNy42LDUxNi43LDUxNy41eiBNNTk4LjMsNDE0LjgNCgkJCWMtMjkuMS0yMC43LTU5LjctNTIuNC03Ni04Ni4yYzM4LjMtMjguNCw3MC42LTU1LjQsOTQuMi0xMTUuM0M2MzQuNiwyNzYuNSw2MjYuOCwzNTYuNiw1OTguMyw0MTQuOHoiLz4NCgk8L2c+DQo8L2c+DQo8L3N2Zz4NCg==",
  [WalletName.SUIET]:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMjQiIGZpbGw9InVybCgjcGFpbnQwX3JhZGlhbF8zMDVfMTI1MTYpIi8+PHBhdGggZD0iTTUxLjUgNDMuNmMtMy45IDAtNy42LTMuOS05LjUtNi40LTEuOSAyLjUtNS42IDYuNC05LjUgNi40LTQgMC03LjctMy45LTkuNS02LjQtMS44IDIuNS01LjUgNi40LTkuNSA2LjQtLjggMC0xLjUtLjYtMS41LTEuNSAwLS44LjctMS41IDEuNS0xLjUgMy4yIDAgNy4xLTUuMSA4LjItNi45LjMtLjQuOC0uNyAxLjMtLjdzMSAuMiAxLjMuN2MxLjEgMS44IDUgNi45IDguMiA2LjkgMy4xIDAgNy4xLTUuMSA4LjItNi45LjMtLjQuOC0uNyAxLjMtLjdzMSAuMiAxLjIuN2MxLjEgMS44IDUgNi45IDguMiA2LjkuOSAwIDEuNi43IDEuNiAxLjUgMCAuOS0uNiAxLjUtMS41IDEuNXoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNNTEuNSA1Mi4zYy0zLjkgMC03LjYtMy45LTkuNS02LjQtMS45IDIuNS01LjYgNi40LTkuNSA2LjQtNCAwLTcuNy0zLjktOS41LTYuNC0xLjggMi41LTUuNSA2LjQtOS41IDYuNC0uOCAwLTEuNS0uNi0xLjUtMS41IDAtLjguNy0xLjUgMS41LTEuNSAzLjIgMCA3LjEtNS4xIDguMi02LjkuMy0uNC44LS43IDEuMy0uN3MxIC4zIDEuMy43YzEuMSAxLjggNSA2LjkgOC4yIDYuOSAzLjEgMCA3LjEtNS4xIDguMi02LjkuMy0uNC44LS43IDEuMy0uN3MxIC4zIDEuMi43YzEuMSAxLjggNSA2LjkgOC4yIDYuOS45IDAgMS42LjcgMS42IDEuNSAwIC45LS42IDEuNS0xLjUgMS41ek0xNC42IDM2LjdjLS44IDAtMS40LS41LTEuNi0xLjNsLS4zLTMuNmMwLTEwLjkgOC45LTE5LjggMTkuOC0xOS44IDExIDAgMTkuOCA4LjkgMTkuOCAxOS44bC0uMyAzLjZjLS4xLjgtLjkgMS40LTEuNyAxLjItLjktLjEtMS41LS45LTEuMy0xLjhsLjMtM2MwLTkuMi03LjUtMTYuOC0xNi44LTE2LjgtOS4yIDAtMTYuNyA3LjUtMTYuNyAxNi44bC4yIDMuMWMuMi44LS4zIDEuNi0xLjEgMS44aC0uM3oiIGZpbGw9IiNmZmYiLz48ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9InBhaW50MF9yYWRpYWxfMzA1XzEyNTE2IiBjeD0iMCIgY3k9IjAiIHI9IjEiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDUyLjc1ODAzIDUxLjM1OCAtNTEuNDM5NDcgNTIuODQxNzIgMCA3LjQwNykiPjxzdG9wIHN0b3AtY29sb3I9IiMwMDU4REQiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM2N0M4RkYiLz48L3JhZGlhbEdyYWRpZW50PjwvZGVmcz48L3N2Zz4=",
  [WalletName.BYBIT_WALLET]:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHZpZXdCb3g9IjAgMCA4OCA4OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgMTguN0MwIDguMzcyMjcgOC4zNzIyOCAwIDE4LjcgMEg2OS4zQzc5LjYyNzcgMCA4OCA4LjM3MjI4IDg4IDE4LjdWNjkuM0M4OCA3OS42Mjc3IDc5LjYyNzcgODggNjkuMyA4OEgxOC43QzguMzcyMjcgODggMCA3OS42Mjc3IDAgNjkuM1YxOC43WiIgZmlsbD0iIzQwNDM0NyIvPgo8cGF0aCBkPSJNNy41NzYxNyAyNi44MDY3QzYuNzg1MTYgMjQuMDc4NyA4LjQ3NzUgMjEuMjUzMSAxMS4yNTU5IDIwLjY2M0w1Ny42MDg3IDEwLjgxNzNDNTkuODA5IDEwLjM1IDYyLjA0NDMgMTEuNDQ0MyA2My4wMjQ3IDEzLjQ2ODlMODMuODQ0MyA1Ni40NjU3TDI1LjE3NzYgODcuNTEwMUw3LjU3NjE3IDI2LjgwNjdaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMzEyXzE3NTM0KSIvPgo8cGF0aCBkPSJNOC4xODI0MiAzMC4xNjE4QzcuMzUwNDkgMjcuMjgzOCA5LjI3OTI1IDI0LjM0MTMgMTIuMjUwMiAyMy45NTU5TDczLjY4NjUgMTUuOTg4MUM3Ni4yMzkxIDE1LjY1NzEgNzguNjExMSAxNy4zNjE4IDc5LjExMTEgMTkuODg2N0w4OC4wMDAzIDY0Ljc3NzFMMjQuNjg5MiA4Ny4yNjY1TDguMTgyNDIgMzAuMTYxOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0wIDM0LjIyMjJDMCAyOC44MjIxIDQuMzc3NjYgMjQuNDQ0NSA5Ljc3Nzc4IDI0LjQ0NDVINjguNDQ0NEM3OS4yNDQ3IDI0LjQ0NDUgODggMzMuMTk5OCA4OCA0NFY2OC40NDQ1Qzg4IDc5LjI0NDcgNzkuMjQ0NyA4OCA2OC40NDQ0IDg4SDE5LjU1NTZDOC43NTUzMiA4OCAwIDc5LjI0NDcgMCA2OC40NDQ1VjM0LjIyMjJaIiBmaWxsPSJibGFjayIvPgo8cGF0aCBkPSJNNTguMjIwMSA2MS4xOTU5VjQyLjg3NTVINjEuNzkzN1Y2MS4xOTU5SDU4LjIyMDFaIiBmaWxsPSIjRjdBNjAwIi8+CjxwYXRoIGQ9Ik0xNy40Mzk1IDY2LjY2MzdIOS43Nzc5NVY0OC4zNDM0SDE3LjEzMTNDMjAuNzA0OSA0OC4zNDM0IDIyLjc4NzQgNTAuMzUwNSAyMi43ODc0IDUzLjQ4OTNDMjIuNzg3NCA1NS41MjE1IDIxLjQ1MDQgNTYuODM0NSAyMC41MjU3IDU3LjI3MjFDMjEuNjMxNSA1Ny43ODY5IDIzLjA0NTYgNTguOTQzOCAyMy4wNDU2IDYxLjM4ODVDMjMuMDQ1NiA2NC44MTA4IDIwLjcwNDkgNjYuNjYzNyAxNy40Mzk1IDY2LjY2MzdaTTE2Ljg0ODEgNTEuNTM0M0gxMy4zNTE2VjU1Ljc1NDhIMTYuODQ4MUMxOC4zNjQyIDU1Ljc1NDggMTkuMjEzOCA1NC45MDY0IDE5LjIxMzggNTMuNjQ1NUMxOS4yMTM4IDUyLjM4MjYgMTguMzY2MiA1MS41MzQzIDE2Ljg0ODEgNTEuNTM0M1pNMTcuMDc5MyA1OC45NzA4SDEzLjM1MTZWNjMuNDcyOEgxNy4wNzkzQzE4LjY5OTQgNjMuNDcyOCAxOS40NyA2Mi40NDMyIDE5LjQ3IDYxLjIwOTJDMTkuNDcyIDU5Ljk3MzMgMTguNjk5NCA1OC45NzA4IDE3LjA3OTMgNTguOTcwOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0zMi44OTI1IDU5LjE1MDFWNjYuNjYzN0gyOS4zNDM5VjU5LjE1MDFMMjMuODQxOSA0OC4zNDM0SDI3LjcyMzhMMzEuMTQzMiA1NS43Mjc4TDM0LjUxMDcgNDguMzQzNEgzOC4zOTI2TDMyLjg5MjUgNTkuMTUwMVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00OC41NjMzIDY2LjY2MzdINDAuOTAxN1Y0OC4zNDM0SDQ4LjI1NTFDNTEuODI4NyA0OC4zNDM0IDUzLjkxMTIgNTAuMzUwNSA1My45MTEyIDUzLjQ4OTNDNTMuOTExMiA1NS41MjE1IDUyLjU3NDIgNTYuODM0NSA1MS42NDk1IDU3LjI3MjFDNTIuNzU1MyA1Ny43ODY5IDU0LjE2OTMgNTguOTQzOCA1NC4xNjkzIDYxLjM4ODVDNTQuMTY3NCA2NC44MTA4IDUxLjgyNjggNjYuNjYzNyA0OC41NjMzIDY2LjY2MzdaTTQ3Ljk3MTkgNTEuNTM0M0g0NC40NzUzVjU1Ljc1NDhINDcuOTcxOUM0OS40ODggNTUuNzU0OCA1MC4zMzc2IDU0LjkwNjQgNTAuMzM3NiA1My42NDU1QzUwLjMzNTcgNTIuMzgyNiA0OS40ODggNTEuNTM0MyA0Ny45NzE5IDUxLjUzNDNaTTQ4LjIwMzEgNTguOTcwOEg0NC40NzUzVjYzLjQ3MjhINDguMjAzMUM0OS44MjMyIDYzLjQ3MjggNTAuNTkzOCA2Mi40NDMyIDUwLjU5MzggNjEuMjA5MkM1MC41OTM4IDU5Ljk3MzQgNDkuODIxMyA1OC45NzA4IDQ4LjIwMzEgNTguOTcwOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik03My40MzkgNTEuNTM0M1Y2Ni42NjM3SDY5Ljg2NTRWNTEuNTM0M0g2NS4wODM5VjQ4LjM0MzRINzguMjIyNFY1MS41MzQzSDczLjQzOVoiIGZpbGw9IndoaXRlIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMzEyXzE3NTM0IiB4MT0iNy4zMzMwOCIgeTE9IjI1LjU5NCIgeDI9Ijg0LjYzODEiIHkyPSIyMS43MjE2IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNGRkQ3NDgiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRjdBNjAwIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==",
  [WalletName.GATE_WALLET]:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAP1BMVEUAAAAX5aIjVOYjVeYjVOYjU+UjVOYgUN8jVeYkVOcgWOcoWOcjVOYjVeYjVOcjVOYkVOYjU+YY5KIjVOYX5aFnl2IZAAAAE3RSTlMAn+/fn5CAEGBAICDPr3C/v1Bg8gPz/wAAAYNJREFUWMOtl9lywzAIRYkQ2mzZSen/f2uX6UzGt7IJVc87R4sRYDpjKdJXVqU/UYX1B/KTU9Ank+F+wRZUJwRtV8S7/JRAVKcEUecEq84Jos4Jks4JNp0TtDApYB0R7pLKDXkbxJdRdK+ZPnlHboMDDDYgX9GvCkQRrkQXAvMGYyaPoCiQiFwCxvXJJ6h4/uwURBAs5BQwHsApaLgBr+CBG3AK8B1Xt6AfXwA5BVjJ7l4BfgTxCyCLZwXlvwV29cEjuOs3XqK3ATJ8xp1Mjg18xUTKZHGsX53ESGWjfCS81O7soQ9qapzBfP0MDcG1AR50herZQDSKKpJ5tFpA6+tTCI9ni2RkMT6dPGptA3JUICwnYuVlkEGsiBA9twBEUGTRi2U2HRDrM7r2oL8p+MKQsEsqJckedATDiOAlLDDmedmwzjhJRpJZRGPYtliNRLeIRqpbiPHLYxDg/mFmNbkvdEVh7/JIk3ARnjLZtMLucKRGVoClkov2SH391vDapZze3Ac97ZDnSKHPHwAAAABJRU5ErkJggg==",
  [WalletName.OKX_WALLET]:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJDSURBVHgB7Zq9jtpAEMfHlhEgQLiioXEkoAGECwoKxMcTRHmC5E3IoyRPkPAEkI7unJYmTgEFTYwA8a3NTKScLnCHN6c9r1e3P2llWQy7M/s1Gv1twCP0ej37dDq9x+Zut1t3t9vZjDEHIiSRSPg4ZpDL5fxkMvn1cDh8m0wmfugfO53OoFQq/crn8wxfY9EymQyrVCqMfHvScZx1p9ls3pFxXBy/bKlUipGPrVbLuQqAfsCliq3zl0H84zwtjQrOw4Mt1W63P5LvBm2d+Xz+YzqdgkqUy+WgWCy+Mc/nc282m4FqLBYL+3g8fjDxenq72WxANZbLJeA13zDX67UDioL5ybXwafMYu64Ltn3bdDweQ5R97fd7GyhBQMipx4POeEDHIu2LfDdBIGGz+hJ9CQ1ABjoA2egAZPM6AgiCAEQhsi/C4jHyPA/6/f5NG3Ks2+3CYDC4aTccDrn6ojG54MnEvG00GoVmWLIRNZ7wTCwDHYBsdACy0QHIhiuRETxlICWpMMhGZHmqS8qH6JLyGegAZKMDkI0uKf8X4SWlaZo+Pp1bRrwlJU8ZKLIvUjKh0WiQ3sRUbNVq9c5Ebew7KEo2m/1p4jJ4qAmDaqDQBzj5XyiAT4VCQezJigAU+IDU+z8vJFnGWeC+bKQV/5VZ71FV6L7PA3gg3tXrdQ+DgLhC+75Wq3no69P3MC0NFQpx2lL04Ql9gHK1bRDjsSBIvScBnDTk1WrlGIZBorIDEYJj+rhdgnQ67VmWRe0zlplXl81vcyEt0rSoYDUAAAAASUVORK5CYII=",
};

const WALLET_DOWNLOAD_URLS_MAP: Record<string, Wallet["downloadUrls"]> = {
  [WalletName.SUI_WALLET]: {
    iOS: "https://apps.apple.com/us/app/sui-wallet-mobile/id6476572140",
    android:
      "https://play.google.com/store/apps/details?id=com.mystenlabs.suiwallet",
    extension:
      "https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil",
  },
  [WalletName.NIGHTLY]: {
    iOS: "https://apps.apple.com/us/app/nightly-multichain-wallet/id6444768157",
    android: "https://play.google.com/store/apps/details?id=com.nightlymobile",
    extension:
      "https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa",
  },
  [WalletName.SUIET]: {
    iOS: undefined,
    android: undefined,
    extension:
      "https://chromewebstore.google.com/detail/suiet-sui-wallet/khpkpbbcccdmmclmpigdgddabeilkdpd",
  },
  [WalletName.BYBIT_WALLET]: {
    iOS: "https://apps.apple.com/us/app/bybit-buy-trade-crypto/id1488296980",
    android: "https://play.google.com/store/apps/details?id=com.bybit.app",
    extension:
      "https://chromewebstore.google.com/detail/bybit-wallet/pdliaogehgdbhbnmkklieghmmjkpigpa",
  },
  [WalletName.GATE_WALLET]: {
    iOS: "https://apps.apple.com/us/app/gate-io-buy-bitcoin-crypto/id1294998195",
    android: "https://play.google.com/store/apps/details?id=com.gateio.gateio",
    extension:
      "https://chromewebstore.google.com/detail/gate-wallet/cpmkedoipcpimgecpmgpldfpohjplkpp",
  },
  [WalletName.OKX_WALLET]: {
    iOS: "https://apps.apple.com/us/app/okx-buy-bitcoin-btc-crypto/id1327268470",
    android: "https://play.google.com/store/apps/details?id=com.okinc.okex.gp",
    extension:
      "https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge",
  },

  [WalletName.MSAFE_WALLET]: {
    iOS: undefined,
    android: undefined,
    extension: "https://sui.m-safe.io",
  },
};

export enum WalletContextQueryParams {
  WALLET = "wallet",
}

interface WalletContext {
  isImpersonating?: boolean;
  isConnectWalletDropdownOpen: boolean;
  setIsConnectWalletDropdownOpen: Dispatch<SetStateAction<boolean>>;

  wallets: Wallet[];
  wallet?: Wallet;
  connectWallet: (wallet: Wallet) => void;
  disconnectWallet: () => void;

  accounts: readonly WalletAccount[];
  account?: WalletAccount;
  switchAccount: (
    account: WalletAccount,
    addressNameServiceName?: string,
  ) => void;

  address?: string;
  signExecuteAndWaitForTransaction: (
    transaction: Transaction,
    options?: { auction?: boolean },
  ) => Promise<SuiTransactionBlockResponse>;
}

const WalletContext = createContext<WalletContext>({
  isImpersonating: false,
  isConnectWalletDropdownOpen: false,
  setIsConnectWalletDropdownOpen: () => {
    throw new Error("WalletContextProvider not initialized");
  },

  wallets: [],
  wallet: undefined,
  connectWallet: () => {
    throw new Error("WalletContextProvider not initialized");
  },
  disconnectWallet: () => {
    throw new Error("WalletContextProvider not initialized");
  },

  accounts: [],
  account: undefined,
  switchAccount: () => {
    throw new Error("WalletContextProvider not initialized");
  },

  address: undefined,
  signExecuteAndWaitForTransaction: async () => {
    throw new Error("WalletContextProvider not initialized");
  },
});

export const useWalletContext = () => useContext(WalletContext);

function Inner({ children }: PropsWithChildren) {
  const router = useRouter();
  const queryParams = {
    [WalletContextQueryParams.WALLET]: router.query[
      WalletContextQueryParams.WALLET
    ] as string | undefined,
  };

  const { suiClient } = useSettingsContext();

  // Impersonated address
  const impersonatedAddress = queryParams[WalletContextQueryParams.WALLET];

  // Wallets
  const wallets__installed = useWallets();
  const getInstalledWallet = useCallback(
    (name: string) => wallets__installed.find((w) => w.name === name),
    [wallets__installed],
  );

  const wallets__extension_default: Wallet[] = useMemo(() => {
    const msafeWallet = {
      name: WalletName.MSAFE_WALLET,
      iconUrl: getInstalledWallet(WalletName.MSAFE_WALLET)?.icon,
      type: WalletType.EXTENSION,
      downloadUrls: WALLET_DOWNLOAD_URLS_MAP[WalletName.MSAFE_WALLET],
    };

    if (isInMsafeApp()) return [msafeWallet];
    return [
      {
        name: WalletName.SUI_WALLET,
        iconUrl:
          getInstalledWallet(WalletName.SUI_WALLET)?.icon ??
          WALLET_LOGO_MAP[WalletName.SUI_WALLET],
        type: WalletType.EXTENSION,
        downloadUrls: WALLET_DOWNLOAD_URLS_MAP[WalletName.SUI_WALLET],
      },
      {
        name: WalletName.NIGHTLY,
        iconUrl:
          getInstalledWallet(WalletName.NIGHTLY)?.icon ??
          WALLET_LOGO_MAP[WalletName.NIGHTLY],
        type: WalletType.EXTENSION,
        downloadUrls: WALLET_DOWNLOAD_URLS_MAP[WalletName.NIGHTLY],
      },
      {
        name: WalletName.SUIET,
        iconUrl:
          getInstalledWallet(WalletName.SUIET)?.icon ??
          WALLET_LOGO_MAP[WalletName.SUIET],
        type: WalletType.EXTENSION,
        downloadUrls: WALLET_DOWNLOAD_URLS_MAP[WalletName.SUIET],
      },
      {
        name: WalletName.BYBIT_WALLET,
        iconUrl:
          getInstalledWallet(WalletName.BYBIT_WALLET)?.icon ??
          WALLET_LOGO_MAP[WalletName.BYBIT_WALLET],
        type: WalletType.EXTENSION,
        downloadUrls: WALLET_DOWNLOAD_URLS_MAP[WalletName.BYBIT_WALLET],
      },
      {
        name: WalletName.GATE_WALLET,
        iconUrl:
          getInstalledWallet(WalletName.GATE_WALLET)?.icon ??
          WALLET_LOGO_MAP[WalletName.GATE_WALLET],
        type: WalletType.EXTENSION,
        downloadUrls: WALLET_DOWNLOAD_URLS_MAP[WalletName.GATE_WALLET],
      },
      {
        name: WalletName.OKX_WALLET,
        iconUrl:
          getInstalledWallet(WalletName.OKX_WALLET)?.icon ??
          WALLET_LOGO_MAP[WalletName.OKX_WALLET],
        type: WalletType.EXTENSION,
        downloadUrls: WALLET_DOWNLOAD_URLS_MAP[WalletName.OKX_WALLET],
      },

      msafeWallet,
    ];
  }, [getInstalledWallet]);

  const wallets__extension_installed_default: Wallet[] = useMemo(
    () =>
      wallets__extension_default
        .filter((w) =>
          w.name === WalletName.MSAFE_WALLET
            ? isInMsafeApp()
            : !!getInstalledWallet(w.name),
        )
        .map((w) => ({
          ...w,
          isInstalled: true,
          raw: getInstalledWallet(w.name),
        })),
    [wallets__extension_default, getInstalledWallet],
  );

  const wallets__extension_installed_notDefault: Wallet[] = useMemo(() => {
    if (isInMsafeApp()) return [];

    return wallets__installed
      .filter(
        (w) => !DEFAULT_EXTENSION_WALLET_NAMES.includes(w.name as WalletName),
      )
      .filter((w) => !WEB_WALLET_NAMES.includes(w.name as WalletName))
      .map((w) => ({
        name: w.name,
        isInstalled: true,
        iconUrl: w.icon,
        type: WalletType.EXTENSION,
        raw: w,
      }));
  }, [wallets__installed]);

  const wallets__extension_notInstalled_default: Wallet[] = useMemo(
    () =>
      wallets__extension_default
        .filter((w) =>
          w.name === WalletName.MSAFE_WALLET
            ? !isInMsafeApp()
            : !getInstalledWallet(w.name),
        )
        .map((w) => ({ ...w, isInstalled: false })),
    [wallets__extension_default, getInstalledWallet],
  );

  const wallets__web: Wallet[] = useMemo(() => {
    if (isInMsafeApp()) return [];

    return [
      {
        name: WalletName.STASHED,
        iconUrl: getInstalledWallet(WalletName.STASHED)?.icon,
        type: WalletType.WEB,
        raw: getInstalledWallet(WalletName.STASHED),
      },
    ];
  }, [getInstalledWallet]);

  const wallets = useMemo(
    () => [
      ...wallets__extension_installed_default,
      ...wallets__extension_installed_notDefault,
      ...wallets__extension_notInstalled_default,
      ...wallets__web,
    ],
    [
      wallets__extension_installed_default,
      wallets__extension_installed_notDefault,
      wallets__extension_notInstalled_default,
      wallets__web,
    ],
  );

  // Wallet
  const [isConnectWalletDropdownOpen, setIsConnectWalletDropdownOpen] =
    useState<boolean>(false);

  const { currentWallet: rawWallet } = useCurrentWallet();
  const wallet = useMemo(
    () =>
      rawWallet ? wallets.find((w) => w.name === rawWallet.name) : undefined,
    [rawWallet, wallets],
  );

  const { mutate: connectWallet } = useConnectWallet();
  const connectWalletWrapper = useCallback(
    (_wallet: Wallet) => {
      try {
        if (!_wallet.raw) throw new Error("Missing wallet");

        connectWallet(
          { wallet: _wallet.raw },
          {
            onSuccess: () => {
              showInfoToast(`Connected ${_wallet.name}`);
              setIsConnectWalletDropdownOpen(false);
            },
            onError: (err) => {
              showErrorToast(`Failed to connect ${_wallet.name}`, err);
              console.error(err);
            },
          },
        );
      } catch (err) {
        showErrorToast(`Failed to connect ${_wallet.name}`, err as Error);
        console.error(err);
      }
    },
    [connectWallet],
  );

  const { mutate: disconnectWallet } = useDisconnectWallet();
  const disconnectWalletWrapper = useCallback(() => {
    try {
      disconnectWallet(undefined, {
        onSuccess: () => {
          showInfoToast("Disconnected wallet");
        },
        onError: (err) => {
          showErrorToast("Failed to disconnect wallet", err);
          console.error(err);
        },
      });
    } catch (err) {
      showErrorToast("Failed to disconnect wallet", err as Error);
      console.error(err);
    }
  }, [disconnectWallet]);

  // Accounts
  const accounts = useAccounts();
  const account = useCurrentAccount() ?? undefined;
  const { mutate: switchAccount } = useSwitchAccount();

  const switchAccountWrapper = useCallback(
    (_account: WalletAccount, addressNameServiceName?: string) => {
      const accountLabel =
        _account?.label ??
        addressNameServiceName ??
        formatAddress(_account.address);

      try {
        switchAccount(
          { account: _account },
          {
            onSuccess: () => {
              showInfoToast(`Switched to ${accountLabel}`, {
                description: _account?.label
                  ? (addressNameServiceName ?? formatAddress(_account.address))
                  : undefined,
              });
            },
            onError: (err) => {
              showErrorToast(`Failed to switch to ${accountLabel}`, err);
            },
          },
        );
      } catch (err) {
        showErrorToast(`Failed to switch to ${accountLabel}`, err as Error);
        console.error(err);
      }
    },
    [switchAccount],
  );

  // Sentry
  useEffect(() => {
    if (impersonatedAddress || !account?.address) Sentry.setUser(null);
    else {
      Sentry.setUser({ id: account?.address });
      Sentry.setTag("wallet", wallet?.name);
    }
  }, [impersonatedAddress, account?.address, wallet?.name]);

  // LaunchDarkly
  const ldClient = useLDClient();
  const ldKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!ldClient) return;

    const key = impersonatedAddress ?? account?.address;
    if (ldKeyRef.current === key) return;

    (async () => {
      await ldClient.identify(!key ? { anonymous: true } : { key });
      ldKeyRef.current = key;
    })();
  }, [ldClient, impersonatedAddress, account?.address]);

  // Tx
  const { gasBudget } = useSettingsContext();
  const { mutateAsync: signTransaction } = useSignTransaction();

  const signExecuteAndWaitForTransaction = useCallback(
    async (transaction: Transaction, options?: { auction?: boolean }) => {
      if (gasBudget !== "")
        transaction.setGasBudget(
          +new BigNumber(gasBudget)
            .times(10 ** SUI_DECIMALS)
            .integerValue(BigNumber.ROUND_DOWN),
        );

      const _address = impersonatedAddress ?? account?.address;
      if (_address) {
        (async () => {
          try {
            const simResult = await suiClient.devInspectTransactionBlock({
              sender: _address,
              transactionBlock: transaction,
            });
            console.log(simResult);

            if (simResult.error) {
              throw simResult.error;
            }
          } catch (err) {
            Sentry.captureException(err, {
              tags: {
                simulation: true,
              },
            });
            console.error(err);
            // throw err; - Do not rethrow error
          }
        })(); // Do not await
      }

      try {
        // Sign
        const signedTransaction = await signTransaction({
          transaction,
          chain: "sui:mainnet",
        });

        // Shio auction (only for swaps)
        if (options?.auction) {
          try {
            await executeAuction(
              signedTransaction.bytes,
              signedTransaction.signature,
            );
          } catch (err) {}
        }

        // Execute
        const res1 = await suiClient.executeTransactionBlock({
          transactionBlock: signedTransaction.bytes,
          signature: signedTransaction.signature,
        });

        // Wait
        const res2 = await suiClient.waitForTransaction({
          digest: res1.digest,
          options: {
            showBalanceChanges: true,
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
          },
        });
        if (
          res2.effects?.status !== undefined &&
          res2.effects.status.status === "failure"
        )
          throw new Error(res2.effects.status.error ?? "Transaction failed");

        return res2;
      } catch (err) {
        Sentry.captureException(err);
        console.error(err);
        throw err;
      }
    },
    [
      gasBudget,
      impersonatedAddress,
      account?.address,
      suiClient,
      signTransaction,
    ],
  );

  // Context
  const contextValue = useMemo(
    () => ({
      isImpersonating: !!impersonatedAddress,
      isConnectWalletDropdownOpen,
      setIsConnectWalletDropdownOpen,

      wallets,
      wallet,
      connectWallet: connectWalletWrapper,
      disconnectWallet: disconnectWalletWrapper,

      accounts,
      account,
      switchAccount: switchAccountWrapper,

      address: impersonatedAddress ?? account?.address,
      signExecuteAndWaitForTransaction,
    }),
    [
      impersonatedAddress,
      isConnectWalletDropdownOpen,
      wallets,
      wallet,
      connectWalletWrapper,
      disconnectWalletWrapper,
      accounts,
      account,
      switchAccountWrapper,
      signExecuteAndWaitForTransaction,
    ],
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

interface WalletContextProviderProps extends PropsWithChildren {
  appName: string;
}

export function WalletContextProvider({
  appName,
  children,
}: WalletContextProviderProps) {
  const { rpc } = useSettingsContext();

  const { networkConfig } = createNetworkConfig({
    mainnet: { url: rpc.url },
  });
  const queryClient = new QueryClient();

  // MSafe Wallet
  const didRegisterMsafeWalletRef = useRef<boolean>(false);
  useEffect(() => {
    if (didRegisterMsafeWalletRef.current) return;

    registerWallet(new MSafeWallet(appName, rpc.url, "sui:mainnet"));
    didRegisterMsafeWalletRef.current = true;
  }, [appName, rpc.url]);

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
        <MystenWalletProvider
          preferredWallets={DEFAULT_EXTENSION_WALLET_NAMES}
          autoConnect
          stashedWallet={{ name: appName }}
        >
          <Inner>{children}</Inner>
        </MystenWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
