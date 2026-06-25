// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title  Notary — Cardiofy on-chain registry
 * @notice Smart contract unico del modulo blockchain Cardiofy. Gestisce tre concerns:
 *         1. Notarizzazione di contratti (mapping contractId -> contentHash).
 *         2. Notarizzazione di asset (mapping assetId -> {contentHash, notarizedAt, totalViews}).
 *         3. Aggiornamento periodico (giornaliero) dei contatori di view degli asset.
 *
 *         Audit pubblico: l'integrità di ciascun dato è verificabile da chiunque
 *         leggendo direttamente la blockchain (chain ID + indirizzo del contratto),
 *         senza intermediazione del backend Cardiofy.
 *
 * @dev    Governance: estende `Ownable2Step` (OpenZeppelin). Il trasferimento di
 *         ownership avviene in due fasi:
 *           1. `transferOwnership(newOwner)` chiamato dall'owner corrente → setta
 *              `pendingOwner = newOwner` (niente effetto immediato sull'owner).
 *           2. `acceptOwnership()` chiamato dal `pendingOwner` → finalizza il transfer.
 *         Protegge da typo (un address sbagliato non può accettare) e dà finestra
 *         di tempo per accorgersi di un compromise dell'owner key.
 */
contract Notary is Ownable2Step {
    address public attester;

    // --- Notarizzazione contratti ---
    mapping(bytes32 contractId => bytes32 contentHash) public contracts;
    event ContractNotarized(bytes32 indexed contractId, bytes32 contentHash, uint64 timestamp);

    // --- Notarizzazione asset ---
    struct Asset {
        bytes32 contentHash;
        uint64  notarizedAt;
        uint256 totalViews;
    }
    mapping(bytes32 assetId => Asset) public assets;
    event AssetNotarized(bytes32 indexed assetId, bytes32 contentHash, uint64 timestamp);

    // --- Aggiornamento periodico view per asset ---
    struct AssetViewUpdate {
        bytes32 assetId;
        uint64  viewsInPeriod;
    }
    event AssetViewsRecorded(
        bytes32 indexed assetId,
        uint64  indexed periodId,
        uint64  viewsInPeriod,
        uint256 newCumulative
    );
    event BatchPublished(uint64 indexed periodId, uint256 assetCount);

    // --- Governance ---
    event AttesterRotated(address indexed oldAttester, address indexed newAttester);

    // --- Errors ---
    error NotAttester();
    error AlreadyExists();
    error UnknownAsset(bytes32 assetId);
    error EmptyHash();
    error ZeroAddress();
    error EmptyBatch();

    modifier onlyAttester() {
        if (msg.sender != attester) revert NotAttester();
        _;
    }

    /**
     * @param initialAttester chiave operativa che firma `notarize*` e `publishBatch`.
     * @param initialOwner    chiave amministrativa (potrebbe coincidere con `initialAttester`
     *                        in deploy single-key; in produzione consolidata: address di una
     *                        Safe multi-firma).
     */
    constructor(address initialAttester, address initialOwner) Ownable(initialOwner) {
        if (initialAttester == address(0)) revert ZeroAddress();
        attester = initialAttester;
    }

    /// @notice Notarizza un contratto rifiutando sovrascritture.
    function notarizeContract(bytes32 contractId, bytes32 contentHash) external onlyAttester {
        if (contentHash == bytes32(0)) revert EmptyHash();
        if (contracts[contractId] != bytes32(0)) revert AlreadyExists();
        contracts[contractId] = contentHash;
        emit ContractNotarized(contractId, contentHash, uint64(block.timestamp));
    }

    /// @notice Notarizza un asset rifiutando sovrascritture; inizializza il contatore a zero.
    function notarizeAsset(bytes32 assetId, bytes32 contentHash) external onlyAttester {
        if (contentHash == bytes32(0)) revert EmptyHash();
        if (assets[assetId].notarizedAt != 0) revert AlreadyExists();
        assets[assetId] = Asset({
            contentHash: contentHash,
            notarizedAt: uint64(block.timestamp),
            totalViews:  0
        });
        emit AssetNotarized(assetId, contentHash, uint64(block.timestamp));
    }

    /**
     * @notice Aggiorna i contatori di view per gli asset attivi nel periodo.
     * @dev    Rifiuta batch vuoti ed asset non notarizzati. Le sovrascritture sui contatori
     *         sono additive (somma). Lo stesso periodo può essere chiamato più volte se serve
     *         (es. retry di parti del batch), ma in esercizio tipico il backend invia un'unica
     *         transazione per periodo.
     */
    function publishBatch(uint64 periodId, AssetViewUpdate[] calldata updates) external onlyAttester {
        if (updates.length == 0) revert EmptyBatch();
        for (uint256 i = 0; i < updates.length; i++) {
            AssetViewUpdate calldata u = updates[i];
            Asset storage a = assets[u.assetId];
            if (a.notarizedAt == 0) revert UnknownAsset(u.assetId);
            a.totalViews += u.viewsInPeriod;
            emit AssetViewsRecorded(u.assetId, periodId, u.viewsInPeriod, a.totalViews);
        }
        emit BatchPublished(periodId, updates.length);
    }

    /// @notice Ruota l'indirizzo attester (chiave operativa). Solo l'owner.
    function rotateAttester(address newAttester) external onlyOwner {
        if (newAttester == address(0)) revert ZeroAddress();
        emit AttesterRotated(attester, newAttester);
        attester = newAttester;
    }
}
