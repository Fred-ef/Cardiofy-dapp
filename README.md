# Cardiofy-dapp

Modulo blockchain della piattaforma Cardiofy: REST API gateway verso lo smart contract `Notary` (notarizzazione di contratti, notarizzazione di asset, batch giornaliero dei contatori view per asset, riconciliazione automatica delle conferme on-chain).

## Layout (monorepo turbo)

```
apps/
  backend/       Servizio Node.js + Express (TypeScript, tsyringe DI, Drizzle ORM)
  notary/        Smart contract Notary.sol (Hardhat + OpenZeppelin)
docs/            Specifica tecnica (LaTeX) per il committente
ai-context/      Note di design (ignorate dal git)
```

## Quick start (sviluppo)

```bash
# 1. Installa le dipendenze del workspace
npm install

# 2. Avvia Postgres in Docker
npm run db:up -w backend                        # container `cardiofy_postgres` su 5432

# 3. Backend: configura env, applica migrazioni, avvia
cp apps/backend/.env.example apps/backend/.env  # personalizza DATABASE_URL e (se disponibili) NOTARY_*
npm run db:migrate -w backend                   # applica le migrazioni Drizzle
npm run dev -w backend                          # avvia in watch mode (porta 3001)

# 4. Notary smart contract: compila, testa, opzionalmente deploya su testnet
npm run notary:keygen -- --write-env            # (prima volta) genera hot key in apps/notary/.env
# poi modifica apps/notary/.env per impostare NOTARY_RPC_URL + (opz) ETHERSCAN_API_KEY
# finanzia con gas l'address stampato da keygen
npm run notary:compile
npm run notary:test
npm run notary:deploy:sepolia                   # opzionale: deploy su Sepolia
npm run notary:address:sync -- --network=sepolia # propaga l'address al apps/backend/.env
```

Procedura completa di go-live in produzione: [docs/runbooks/deploy-and-go-live.md](docs/runbooks/deploy-and-go-live.md).

## Script npm (root, allineati a CMP)

| Comando | Effetto |
|---|---|
| `npm run build` | `turbo run build` su tutti i workspace |
| `npm run dev` | `turbo run dev` (backend in watch) |
| `npm test` | `turbo run test` (unit vitest + hardhat test) |
| `npm run test -w backend -- test:integration` | Vitest integration con testcontainers (Postgres ephemeral) |
| `npm run lint` / `lint:fix` | ESLint su backend |
| `npm run type-check` | `tsc --noEmit` su backend |
| `npm run db:sync` | Genera nuova migrazione Drizzle dallo schema **e** la applica |
| `npm run db:migrate` | Applica solo le migrazioni esistenti |
| `npm run db:seed` | Esegue lo script di seed (placeholder per V0) |
| `npm run notary:compile` | `hardhat compile` |
| `npm run notary:test` | `hardhat test` |
| `npm run notary:keygen [-- --write-env] [-- --json]` | Genera una nuova hot key per il deployer/attester (pattern `cast wallet new`) |
| `npm run notary:deploy:sepolia` / `:gnosis` | Deploy Notary via Ignition |
| `npm run notary:address [-- --network=<chain>]` | Stampa l'address del Notary deployato |
| `npm run notary:address:sync [-- --network=<chain>]` | Aggiorna `apps/backend/.env` con address + chainId |
| `npm run notary:verify -- asset <BACKEND_URL> <assetId>` | Verifica indipendente API↔chain di un asset |
| `npm run notary:verify -- contract <BACKEND_URL> <contractId>` | Verifica indipendente API↔chain di un contratto |
| `npm run transfer-owner -w notary -- --network=<chain> --new-owner=0x<addr>` | Trasferimento ownership del Notary (multi-sig) |
| `npm run db:up -w backend` / `db:down` / `db:logs` | Gestione del Docker Postgres locale |

## Endpoint principali (V1)

| Metodo | Path | Auth | Scopo |
|---|---|---|---|
| `POST` | `/api/v1/contracts/{contractId}/notarize` | sì | Notarizza un contratto |
| `GET`  | `/api/v1/contracts/{contractId}` | sì | Stato di un contratto notarizzato |
| `POST` | `/api/v1/assets/{assetId}/notarize` | sì | Notarizza un asset |
| `GET`  | `/api/v1/assets/{assetId}` | sì | Stato + `totalViews` di un asset |
| `POST` | `/api/v1/views` | sì | Registra una view valida (`Idempotency-Key` obbligatoria) |
| `GET`  | `/api/v1/batches/{periodId}` | sì | Metadati di un batch giornaliero |
| `GET`  | `/api/v1/chain/info` | pubblico | Riferimenti per l'audit indipendente (chainId, contract address, RPC) |
| `GET`  | `/api/v1/health/live` | pubblico | Liveness probe (sempre 200) |
| `GET`  | `/api/v1/health/ready` | pubblico | Readiness probe (200 / 503 con `ReadinessReport`) |

L'auth si attiva con `AUTH_ENABLED=true` + `CORE_AUTH_TOKEN`. Bearer token condiviso fra core e modulo; confronto in tempo costante. Health e chain/info sono sempre pubblici.

## Job pianificati (cron)

| Job | Default | Quando | Sorgente |
|---|---|---|---|
| `BatchJob` | `0 0 * * *` (mezzanotte UTC) | Pubblica on-chain il batch del giorno precedente | [batch.job.ts](apps/backend/src/modules/batches/batch.job.ts) |
| `ReconcileJob` | `*/5 * * * *` (ogni 5 min) | Aggiorna lo status `PENDING → CONFIRMED` quando le conferme on-chain raggiungono `NOTARY_CONFIRMATIONS` | [reconciliation.job.ts](apps/backend/src/modules/reconciliation/reconciliation.job.ts) |

Entrambi i job restano disabilitati automaticamente se le credenziali on-chain (`NOTARY_RPC_URL`, `NOTARY_PRIVATE_KEY`, `NOTARY_CONTRACT_ADDRESS`) non sono configurate.

## Documentazione

- Specifica tecnica per il committente: [docs/cardiofy-blockchain-specification.tex](docs/cardiofy-blockchain-specification.tex).
- Design notes interne: [ai-context/design/](ai-context/design/) (non committate).
- Task backlog (debito tecnico noto): [ai-context/design/task-backlog.md](ai-context/design/task-backlog.md).
