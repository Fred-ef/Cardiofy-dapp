/**
 * Principal: identità del chiamante autenticato sul confine M2M core↔notary.
 *
 * Il modello è binario (o sei il core Cardiofy fidato, o non lo sei), quindi oggi
 * esiste un solo `kind`. Il tipo è volutamente estendibile: se in futuro si
 * aggiungono altri chiamanti fidati (es. una CLI admin con token proprio), basta
 * ampliare l'unione senza toccare l'enforcement.
 */
export type Principal = { kind: 'core-service' };
