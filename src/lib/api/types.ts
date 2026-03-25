export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface CreateMintRequest {
  chainId: string;
  amount: number;
  destinationAddress: string;
}

export interface CreateRedeemRequest {
  chainId: string;
  amount: number;
  bankAccountId: string;
  walletAddress: string;
}
