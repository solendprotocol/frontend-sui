import { ExternalToast, toast as sonnerToast } from "sonner";

import { TOAST_DURATION_MS } from "./constants";

const onDismiss = (callback: () => void) => {
  for (let i = 0; i < 10; i++) sonnerToast.dismiss();
  setTimeout(() => {
    callback();
  }, 250);
};

export const showSuccessToast = (
  title: string,
  data?: Omit<ExternalToast, "duration">,
) => {
  onDismiss(() =>
    sonnerToast.success(title, {
      ...(data || {}),
      duration: TOAST_DURATION_MS,
    }),
  );
};

export const showInfoToast = (
  title: string,
  data?: Omit<ExternalToast, "duration">,
) => {
  onDismiss(() =>
    sonnerToast.info(title, {
      ...(data || {}),
      duration: TOAST_DURATION_MS,
    }),
  );
};

export const showWarningToast = (
  title: string,
  data?: Omit<ExternalToast, "duration">,
) => {
  onDismiss(() =>
    sonnerToast.warning(title, {
      ...(data || {}),
      duration: TOAST_DURATION_MS,
    }),
  );
};

export const showErrorToast = (
  title: string,
  err: Error,
  data?: Omit<ExternalToast, "description" | "duration">,
) => {
  let description = (err?.message as string) || "An unknown error occurred";
  if (description[0].toLowerCase() === description[0])
    description = `${description[0].toUpperCase()}${description.slice(1)}`;

  onDismiss(() =>
    sonnerToast.error(title, {
      ...(data || {}),
      description,
      duration: TOAST_DURATION_MS,
    }),
  );
};
