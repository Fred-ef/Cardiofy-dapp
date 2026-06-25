export type OnchainStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

interface ContractProps {
  contractId:  string;
  contentHash: string;
  status:      OnchainStatus;
  txHash:      string | null;
  blockNumber: number | null;
  notarizedAt: Date;
  confirmedAt: Date | null;
}

export class Contract {
  public readonly contractId:  string;
  public readonly contentHash: string;
  public readonly status:      OnchainStatus;
  public readonly txHash:      string | null;
  public readonly blockNumber: number | null;
  public readonly notarizedAt: Date;
  public readonly confirmedAt: Date | null;

  private constructor(p: ContractProps) {
    this.contractId  = p.contractId;
    this.contentHash = p.contentHash;
    this.status      = p.status;
    this.txHash      = p.txHash;
    this.blockNumber = p.blockNumber;
    this.notarizedAt = p.notarizedAt;
    this.confirmedAt = p.confirmedAt;
  }

  static reconstitute(p: ContractProps): Contract {
    return new Contract(p);
  }
}
