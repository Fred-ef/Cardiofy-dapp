/**
 * Stato di una transazione on-chain associata a un'entità del modulo
 * (asset, contract, batch). Specchio del pgEnum `onchain_status` lato DB
 * e dello stato che il backend usa internamente.
 */
export const ONCHAIN_STATUS_VALUES = ['PENDING', 'CONFIRMED', 'FAILED'] as const;

export type OnchainStatus = (typeof ONCHAIN_STATUS_VALUES)[number];
