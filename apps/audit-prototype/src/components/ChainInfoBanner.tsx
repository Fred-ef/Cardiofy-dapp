import type { ChainInfoDto } from '@cardiofy/shared';
import { addrLink, shortHash } from '../lib/format.js';

export function ChainInfoBanner({ chainInfo }: { chainInfo: ChainInfoDto }) {
  const link = addrLink(chainInfo, chainInfo.contractAddress);
  return (
    <div className="chain-info-banner">
      <span>
        Chain ID: <strong>{chainInfo.chainId}</strong>
      </span>
      <span>
        Notary:{' '}
        {chainInfo.contractAddress ? (
          link ? (
            <a href={link} target="_blank" rel="noreferrer" className="mono">
              {shortHash(chainInfo.contractAddress)}
            </a>
          ) : (
            <span className="mono">{shortHash(chainInfo.contractAddress)}</span>
          )
        ) : (
          <em>non configurato</em>
        )}
      </span>
      <span>
        RPC: <span className="mono">{chainInfo.recommendedRPC}</span>
      </span>
    </div>
  );
}
