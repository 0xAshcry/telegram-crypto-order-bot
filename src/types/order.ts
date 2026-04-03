export type CreateOrderBody = {
  telegramId: string;
  username?: string;
  coinSymbol: string;
  rupiahAmount: number;
  paymentMethod: "QRIS" | "BANK_TRANSFER";
};
