import { useState } from 'react';
import { useChainInfo } from './hooks/useChainInfo.js';
import { HealthPill } from './components/HealthPill.js';
import { ChainInfoBanner } from './components/ChainInfoBanner.js';
import { ErrorPanel } from './components/ErrorPanel.js';
import { AssetResult } from './components/AssetResult.js';
import { ContractResult } from './components/ContractResult.js';
import { BatchResult } from './components/BatchResult.js';

type Tab = 'asset' | 'contract' | 'batch';

const TABS: { key: Tab; label: string }[] = [
  { key: 'asset', label: 'Asset' },
  { key: 'contract', label: 'Contratto' },
  { key: 'batch', label: 'Batch' },
];

export function App() {
  const { chainInfo, error, loading } = useChainInfo();
  const [tab, setTab] = useState<Tab>('asset');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cardiofy — Audit pubblico</h1>
        <HealthPill />
      </header>

      <p className="disclaimer">
        ⚠️ Prototipo dimostrativo — nessuna garanzia, pensato per mostrare ai revisori il flusso di
        verifica indipendente API ↔ blockchain. Non usare in produzione.
      </p>

      {loading && <p>Caricamento informazioni sulla chain…</p>}
      {error && <ErrorPanel error={error} />}

      {chainInfo && (
        <>
          <ChainInfoBanner chainInfo={chainInfo} />

          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={t.key === tab ? 'tab tab--active' : 'tab'}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'asset' && <AssetResult chainInfo={chainInfo} />}
          {tab === 'contract' && <ContractResult chainInfo={chainInfo} />}
          {tab === 'batch' && <BatchResult chainInfo={chainInfo} />}
        </>
      )}
    </div>
  );
}
