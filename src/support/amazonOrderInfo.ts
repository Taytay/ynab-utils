export interface IAmazonOrder {
  orderId: string;
  amount: string;
}

export interface IAmazonOrderItem {
  orderId: string;
  description: string;
}

export type IAmazonItemsByAmount = Map<string, string>;
