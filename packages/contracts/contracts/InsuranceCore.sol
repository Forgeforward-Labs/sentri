// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IPolicyVaultCore {
    function availableLiquidity() external view returns (uint256);
    function lockFunds(uint256 positionId, uint256 amount, uint256 premium) external;
    function unlockFunds(uint256 positionId) external;
    function refundPremium(uint256 positionId, address holder) external;
    function utilizationMultiplierBps() external view returns (uint256);
}

interface IAgentOrchestratorCore {
    function startDepegValidationBatch(
        uint256[] calldata positionIds,
        uint256 observedPrice,
        uint256 threshold,
        uint256[] calldata coverageAmounts
    ) external;
    function startRugValidationBatch(
        uint256[] calldata positionIds,
        uint256 observedLiquidityPct,
        uint256 threshold,
        uint256[] calldata coverageAmounts
    ) external;
}

contract InsuranceCore is Ownable {
    enum TriggerType {
        DEPEG,
        RUG
    }

    enum PositionStatus {
        ACTIVE,
        CLAIMED,
        CANCELLED,
        EXPIRED
    }

    struct Product {
        uint256 id;
        string name;
        TriggerType triggerType;
        bytes triggerParams;
        uint256 premiumRateBps;
        uint256 duration;
        uint256 maxPerPosition;
        uint256 poolLimit;
        uint256 totalCommitted;
        uint256 referenceTVL;
        bool active;
    }

    struct Position {
        uint256 id;
        uint256 productId;
        address holder;
        uint256 coverageAmount;
        uint256 premium;
        uint256 createdAt;
        uint256 expiresAt;
        PositionStatus status;
        uint256 claimedPrice;
        uint256 claimedPayout;
    }

    struct DepegParams {
        address pool;
        uint256 threshold;
    }

    struct RugParams {
        address token;
        address pool;
        uint256 liquidityThreshold;
    }

    uint256 public productCount;
    uint256 public positionCount;
    address public tracker;
    address public agentOrchestrator;
    address public claimProcessor;
    IPolicyVaultCore public immutable vault;

    mapping(uint256 => Product) public products;
    mapping(uint256 => Position) public positions;
    /// @notice Total coverage committed per holder per product (used for per-holder cap).
    mapping(uint256 => mapping(address => uint256)) public committedByHolder;

    event ProductCreated(uint256 indexed id, string name, TriggerType triggerType);
    event ProductPaused(uint256 indexed id, string reason);
    event ProductUnpaused(uint256 indexed id);
    event PositionCreated(
        uint256 indexed id,
        address indexed holder,
        uint256 indexed productId,
        uint256 coverageAmount
    );
    event PositionExpired(uint256 indexed id);
    event PositionClaimed(uint256 indexed id, uint256 payout, uint256 confirmedPrice);
    event TrackerUpdated(address indexed tracker);
    event AgentOrchestratorUpdated(address indexed agentOrchestrator);
    event ClaimProcessorUpdated(address indexed claimProcessor);

    error OnlyTracker();
    error OnlyOwnerOrTracker();
    error OnlyClaimProcessor();
    error ProductInactive();
    error PositionStateInvalid();
    error PerHolderLimitReached();
    error PoolLimitReached();
    error InsufficientLiquidity();
    error EmptyBatch();
    error MixedProductsInBatch();

    constructor(address vaultAddress) Ownable(msg.sender) {
        vault = IPolicyVaultCore(vaultAddress);
    }

    modifier onlyTracker() {
        if (msg.sender != tracker) revert OnlyTracker();
        _;
    }

    modifier onlyOwnerOrTracker() {
        if (msg.sender != owner() && msg.sender != tracker) revert OnlyOwnerOrTracker();
        _;
    }

    modifier onlyClaimProcessor() {
        if (msg.sender != claimProcessor) revert OnlyClaimProcessor();
        _;
    }

    function setTracker(address trackerAddress) external onlyOwner {
        tracker = trackerAddress;
        emit TrackerUpdated(trackerAddress);
    }

    function setAgentOrchestrator(address agentOrchestratorAddress) external onlyOwner {
        agentOrchestrator = agentOrchestratorAddress;
        emit AgentOrchestratorUpdated(agentOrchestratorAddress);
    }

    function setClaimProcessor(address claimProcessorAddress) external onlyOwner {
        claimProcessor = claimProcessorAddress;
        emit ClaimProcessorUpdated(claimProcessorAddress);
    }

    function createDepegProduct(
        string calldata name,
        address pool,
        uint256 threshold,
        uint256 premiumRateBps,
        uint256 duration,
        uint256 maxPerPosition,
        uint256 poolLimit
    ) external onlyOwner returns (uint256 productId) {
        productId = ++productCount;
        products[productId] = Product({
            id: productId,
            name: name,
            triggerType: TriggerType.DEPEG,
            triggerParams: abi.encode(DepegParams({pool: pool, threshold: threshold})),
            premiumRateBps: premiumRateBps,
            duration: duration,
            maxPerPosition: maxPerPosition,
            poolLimit: poolLimit,
            totalCommitted: 0,
            referenceTVL: 0,
            active: true
        });
        emit ProductCreated(productId, name, TriggerType.DEPEG);
    }

    function createRugProduct(
        string calldata name,
        address token,
        address pool,
        uint256 liquidityThreshold,
        uint256 premiumRateBps,
        uint256 duration,
        uint256 maxPerPosition,
        uint256 poolLimit,
        uint256 referenceTVL
    ) external onlyOwner returns (uint256 productId) {
        require(duration > 0, "duration must be non-zero");
        productId = ++productCount;
        products[productId] = Product({
            id: productId,
            name: name,
            triggerType: TriggerType.RUG,
            triggerParams: abi.encode(RugParams({token: token, pool: pool, liquidityThreshold: liquidityThreshold})),
            premiumRateBps: premiumRateBps,
            duration: duration,
            maxPerPosition: maxPerPosition,
            poolLimit: poolLimit,
            totalCommitted: 0,
            referenceTVL: referenceTVL,
            active: true
        });
        emit ProductCreated(productId, name, TriggerType.RUG);
    }

    function pauseProduct(uint256 productId, string calldata reason) external onlyOwnerOrTracker {
        products[productId].active = false;
        emit ProductPaused(productId, reason);
    }

    function unpauseProduct(uint256 productId) external onlyOwner {
        products[productId].active = true;
        emit ProductUnpaused(productId);
    }

    function buyPosition(uint256 productId, uint256 coverageAmount) external returns (uint256 positionId) {
        Product storage product = products[productId];
        if (!product.active) revert ProductInactive();
        if (committedByHolder[productId][msg.sender] + coverageAmount > product.maxPerPosition) revert PerHolderLimitReached();
        if (product.totalCommitted + coverageAmount > product.poolLimit) revert PoolLimitReached();
        if (vault.availableLiquidity() < coverageAmount) revert InsufficientLiquidity();

        uint256 premium = calculatePremium(productId, coverageAmount);
        positionId = ++positionCount;
        uint256 expiresAt = product.duration == 0 ? 0 : block.timestamp + product.duration;

        positions[positionId] = Position({
            id: positionId,
            productId: productId,
            holder: msg.sender,
            coverageAmount: coverageAmount,
            premium: premium,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            status: PositionStatus.ACTIVE,
            claimedPrice: 0,
            claimedPayout: 0
        });

        product.totalCommitted += coverageAmount;
        committedByHolder[productId][msg.sender] += coverageAmount;
        vault.lockFunds(positionId, coverageAmount, premium);

        emit PositionCreated(positionId, msg.sender, productId, coverageAmount);
    }

    function expirePosition(uint256 positionId) external onlyTracker {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.ACTIVE) revert PositionStateInvalid();

        position.status = PositionStatus.EXPIRED;
        products[position.productId].totalCommitted -= position.coverageAmount;
        committedByHolder[position.productId][position.holder] -= position.coverageAmount;
        vault.unlockFunds(positionId);

        emit PositionExpired(positionId);
    }

    // ── Claim initiation — single position (wraps batch) ────────────────────

    function initiateDepegClaim(uint256 positionId, uint256 observedPrice) external onlyTracker {
        uint256[] memory ids = new uint256[](1);
        ids[0] = positionId;
        _initiateDepegBatch(ids, observedPrice);
    }

    function initiateRugClaim(uint256 positionId, uint256 observedLiquidityPct) external onlyTracker {
        uint256[] memory ids = new uint256[](1);
        ids[0] = positionId;
        _initiateRugBatch(ids, observedLiquidityPct);
    }

    // ── Claim initiation — batch (one agent run, N payouts) ─────────────────

    /// @notice All positionIds must be ACTIVE and belong to the same DEPEG product.
    function initiateDepegClaimBatch(
        uint256[] calldata positionIds,
        uint256 observedPrice
    ) external onlyTracker {
        _initiateDepegBatch(positionIds, observedPrice);
    }

    /// @notice All positionIds must be ACTIVE and belong to the same RUG product.
    function initiateRugClaimBatch(
        uint256[] calldata positionIds,
        uint256 observedLiquidityPct
    ) external onlyTracker {
        _initiateRugBatch(positionIds, observedLiquidityPct);
    }

    function _initiateDepegBatch(
        uint256[] memory positionIds,
        uint256 observedPrice
    ) internal {
        if (positionIds.length == 0) revert EmptyBatch();

        uint256 productId = positions[positionIds[0]].productId;
        DepegParams memory params = abi.decode(products[productId].triggerParams, (DepegParams));

        uint256[] memory coverages = new uint256[](positionIds.length);
        for (uint256 i = 0; i < positionIds.length; i++) {
            Position storage pos = positions[positionIds[i]];
            if (pos.status != PositionStatus.ACTIVE) revert PositionStateInvalid();
            if (pos.productId != productId) revert MixedProductsInBatch();
            coverages[i] = pos.coverageAmount;
        }

        IAgentOrchestratorCore(agentOrchestrator).startDepegValidationBatch(
            positionIds,
            observedPrice,
            params.threshold,
            coverages
        );
    }

    function _initiateRugBatch(
        uint256[] memory positionIds,
        uint256 observedLiquidityPct
    ) internal {
        if (positionIds.length == 0) revert EmptyBatch();

        uint256 productId = positions[positionIds[0]].productId;
        RugParams memory params = abi.decode(products[productId].triggerParams, (RugParams));

        uint256[] memory coverages = new uint256[](positionIds.length);
        for (uint256 i = 0; i < positionIds.length; i++) {
            Position storage pos = positions[positionIds[i]];
            if (pos.status != PositionStatus.ACTIVE) revert PositionStateInvalid();
            if (pos.productId != productId) revert MixedProductsInBatch();
            coverages[i] = pos.coverageAmount;
        }

        IAgentOrchestratorCore(agentOrchestrator).startRugValidationBatch(
            positionIds,
            observedLiquidityPct,
            params.liquidityThreshold,
            coverages
        );
    }

    // ── Claim settlement ────────────────────────────────────────────────────

    function markClaimed(uint256 positionId, uint256 payout) external onlyClaimProcessor {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.ACTIVE) revert PositionStateInvalid();

        position.status = PositionStatus.CLAIMED;
        position.claimedPayout = payout;
        products[position.productId].totalCommitted -= position.coverageAmount;
        committedByHolder[position.productId][position.holder] -= position.coverageAmount;

        emit PositionClaimed(positionId, payout, position.claimedPrice);
    }

    /// @notice Demo helper — owner can manually fire a depeg claim for all active positions
    ///         in a product using any observed price (bypasses tracker requirement).
    function adminInitiateDepeg(uint256 productId, uint256 observedPrice) external onlyOwner {
        uint256[] memory batch = new uint256[](positionCount);
        uint256 count = 0;
        for (uint256 i = 1; i <= positionCount; i++) {
            if (positions[i].productId == productId && positions[i].status == PositionStatus.ACTIVE) {
                batch[count++] = i;
            }
        }
        require(count > 0, "no active positions");
        uint256[] memory trimmed = new uint256[](count);
        for (uint256 i = 0; i < count; i++) trimmed[i] = batch[i];
        _initiateDepegBatch(trimmed, observedPrice);
    }

    function setClaimedPrice(uint256 positionId, uint256 confirmedPrice) external {
        require(msg.sender == agentOrchestrator, "only orchestrator");
        positions[positionId].claimedPrice = confirmedPrice;
    }

    function positionHolder(uint256 positionId) external view returns (address) {
        return positions[positionId].holder;
    }

    function calculatePremium(uint256 productId, uint256 amount) public view returns (uint256) {
        Product storage product = products[productId];
        // Annual rate pro-rated over duration, then scaled by utilization multiplier.
        // Multiplier rises with pool utilization (1x → 3x), boosting LP yield and
        // dynamically repricing coverage when the pool is heavily used.
        uint256 base = (amount * product.premiumRateBps * product.duration) / (10_000 * 365 days);
        uint256 multiplier = vault.utilizationMultiplierBps(); // 10_000 / 15_000 / 20_000 / 30_000
        uint256 premium = (base * multiplier) / 10_000;
        return premium < 1e6 ? 1e6 : premium;
    }
}
