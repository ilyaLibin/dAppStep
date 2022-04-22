export type OptionalBlock = {
  height: number
}

export type AddressItem = {
  amount: string,
  address: string
}

export type Asset = {
  tokenId: string;
  amount: number;
  decimals?: number;
  name: string;
  tokenType?: string;
}

export type Balance = {
  nanoErgs: number,
  tokens: Asset[]
}
