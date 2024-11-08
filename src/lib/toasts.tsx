import { ReactNode } from "react";

import { ExternalToast, toast } from "sonner";

import { TOAST_DURATION_MS, TX_TOAST_DURATION_MS } from "../lib/constants";

const onDismiss = (callback: () => void) => {
  for (let i = 0; i < 10; i++) toast.dismiss();
  setTimeout(() => {
    callback();
  }, 250);
};

const toasts = {
  info: (title: string, data?: ExternalToast) => {
    onDismiss(() => toast.info(title, data));
  },
  success: (
    title: string,
    description?: string,
    txUrl?: string,
    txAction?: ReactNode,
  ) => {
    onDismiss(() =>
      toast.success(title, {
        description,
        action: txUrl ? txAction : undefined,
        duration: txUrl ? TX_TOAST_DURATION_MS : TOAST_DURATION_MS,
      }),
    );
  },
  error: (title: string, err: Error, isTransaction?: boolean) => {
    let description = (err?.message as string) || "An unknown error occurred";
    if (description[0].toLowerCase() === description[0])
      description = `${description[0].toUpperCase()}${description.slice(1)}`;

    onDismiss(() =>
      toast.error(title, {
        description,
        duration: isTransaction ? TX_TOAST_DURATION_MS : TOAST_DURATION_MS,
      }),
    );
  },
};

export default toasts;
