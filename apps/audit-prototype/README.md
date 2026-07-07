# audit-prototype

Front-end **prototipo/mock** per mostrare ai revisori il flusso di **audit pubblico** dei dati
Cardiofy: verifica indipendente dei dati dichiarati dall'API confrontandoli con la lettura diretta
dallo smart contract `Notary` (stessa logica di [`apps/notary/scripts/verify.ts`](../notary/scripts/verify.ts),
portata nel browser).

Non è un prodotto: nessun login, nessuno stato server, nessuna scrittura on-chain. Solo lettura, solo
i path pubblici/di audit del backend.

Piano implementativo dettagliato: [`ai-context/future-tasks/audit-prototype-plan.md`](../../ai-context/future-tasks/audit-prototype-plan.md).

## Avvio rapido

```bash
# 1) Backend con dati e SENZA auth (più semplice per la demo)
#    apps/backend/.env: AUTH_ENABLED=false, NOTARY_* configurati (RPC + contract su Sepolia)
npm run db:up -w backend && npm run db:migrate -w backend
npm run dev -w backend            # :3001

# 2) Prototipo
cp apps/audit-prototype/.env.example apps/audit-prototype/.env   # personalizza se serve
npm run dev -w audit-prototype    # :5173 → apri nel browser
```

Se il backend ha `AUTH_ENABLED=true`, incolla il `CORE_AUTH_TOKEN` nel campo "Bearer token" del form
(oppure passa `CARDIOFY_API_TOKEN` come per il CLI `verify.ts`).

## Flusso da mostrare

1. Tab **Asset** → incolla un `assetId` notarizzato → la card mostra "hash API vs hash on-chain" e
   "totalViews API vs on-chain" con verdetto ✅/⚠️/❌.
2. Tab **Contratto** → stesso flusso, solo hash (nessun contatore view).
3. Tab **Batch** → non esiste una lettura on-chain per periodo (il contratto espone solo l'evento
   `BatchPublished`): la card mostra i dati API e un link diretto alla transazione sull'explorer, per
   verifica manuale.

## Note tecniche

- Riusa i tipi **e** gli schemi Zod di `@cardiofy/shared` per validare le risposte API nel browser
  (stesso contratto del backend).
- Le letture on-chain avvengono via `ethers` direttamente dal browser verso `recommendedRPC` restituito
  da `GET /chain/info`. Se l'RPC pubblico di default rifiuta CORS, imposta `VITE_RPC_URL_OVERRIDE` in
  `.env` con un endpoint CORS-friendly (es. Alchemy/Infura/Ankr).
- Il bearer token (se serve) resta solo in memoria (state React): mai in localStorage, mai nel bundle.
