import { SuiTransactionBlockResponse } from "@mysten/sui/client";
import { Transaction, TransactionResult } from "@mysten/sui/transactions";
import { SUI_DECIMALS, normalizeStructTag } from "@mysten/sui/utils";
import BigNumber from "bignumber.js";

import { SuilendClient } from "@suilend/sdk";
import { ObligationOwnerCap } from "@suilend/sdk/_generated/suilend/lending-market/structs";

import { Token } from "./coinMetadata";
import { isSui } from "./coinType";

export const getTotalGasFee = (res: SuiTransactionBlockResponse) =>
  res.effects
    ? new BigNumber(
        +res.effects.gasUsed.computationCost +
          +res.effects.gasUsed.storageCost -
          +res.effects.gasUsed.storageRebate,
      ).div(10 ** SUI_DECIMALS)
    : new BigNumber(0);

export const getBalanceChange = (
  res: SuiTransactionBlockResponse,
  address: string,
  token: Token,
  multiplier: -1 | 1 = 1,
) => {
  if (!res.balanceChanges) return undefined;

  const balanceChanges = res.balanceChanges.filter(
    (bc) =>
      normalizeStructTag(bc.coinType) === token.coinType &&
      (bc.owner as { AddressOwner: string })?.AddressOwner === address,
  );
  if (balanceChanges.length === 0) return undefined;

  return balanceChanges
    .reduce(
      (acc, balanceChange) => acc.plus(new BigNumber(+balanceChange.amount)),
      new BigNumber(0),
    )
    .div(10 ** token.decimals)
    .plus(isSui(token.coinType) ? getTotalGasFee(res) : 0)
    .times(multiplier);
};

export const createObligationIfNoneExists = (
  suilendClient: SuilendClient,
  transaction: Transaction,
  obligationOwnerCap?: ObligationOwnerCap<string>,
): { obligationOwnerCapId: string | TransactionResult; didCreate: boolean } => {
  let obligationOwnerCapId;
  let didCreate = false;
  if (obligationOwnerCap) obligationOwnerCapId = obligationOwnerCap.id;
  else {
    obligationOwnerCapId = suilendClient.createObligation(transaction);
    didCreate = true;
  }

  return { obligationOwnerCapId, didCreate };
};

export const sendObligationToUser = (
  obligationOwnerCapId: string | TransactionResult,
  address: string,
  transaction: Transaction,
) => {
  transaction.transferObjects(
    [obligationOwnerCapId],
    transaction.pure.address(address),
  );
};
