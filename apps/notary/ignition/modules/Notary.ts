import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

/**
 * Deploya il contratto Notary.
 *
 * - `attester` è l'account 0 di Hardhat (cioè la chiave NOTARY_PRIVATE_KEY in config):
 *   il backend Cardiofy firma le transazioni con la stessa chiave usata per il deploy.
 * - `owner` è inizializzato uguale a `attester` per V1. In produzione consolidata,
 *   l'owner andrà trasferito a una cold key o ad una Safe multi-firma (runbook).
 */
const NotaryModule = buildModule('NotaryModule', (m) => {
  const attester = m.getAccount(0);
  const owner    = m.getAccount(0);
  const notary   = m.contract('Notary', [attester, owner]);
  return { notary };
});

export default NotaryModule;
