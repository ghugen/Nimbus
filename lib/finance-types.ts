export type Entry = {
  id: string;
  order_id: string;
  author_id: string;
  title: string;
  gross: number;
  fee: number;
  rate: number;
  platform: number;
  author_net: number;
  refunded_gross: number;
  refunded_author: number;
  release_at: number;
  created: string;
};
export type Payout = {
  id: string;
  author_id: string;
  amount: number;
  reference: string;
  created: string;
};
export type Balance = {
  author_id: string;
  earned: number;
  refunded: number;
  paid: number;
  balance: number;
  available: number;
  payable: number;
  blocked: boolean;
};
export type FinanceReport = {
  entries: Entry[];
  payouts: Payout[];
  pending: {
    id: string;
    order_id: string;
    title: string;
    price: number;
    created: string;
  }[];
  balances: Balance[];
};
export type AuthorPolicy = { commission_bps: number; owned: number };
export type FinanceAccount = AuthorPolicy & {
  id: string;
  name: string;
  email: string;
};
