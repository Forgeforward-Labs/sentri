// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IPolicyVaultCore {
    function availableLiquidity() external view returns (uint256);
    function lockFunds(uint256 positionId, uint256 amount, uint256 premium) external;
    function unlockFunds(uint256 positionId) external;
    function refundPremium(uint256 positionId, address holder) external;
}

interface IAgentOrchestratorCore {
    function startDepegValidation(
        uint256 positionId,
        uint256 observedPrice,
        uint256 threshold,
        uint256 coverageAmount
    ) external;
    function startRugValidation(
        uint256 positionId,
        uint256 observedLiquidityPct,
        uint256 threshold,
        uint256 coverageAmount
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
    error CoverageTooHigh();
    error PoolLimitReached();
    error InsufficientLiquidity();

    constructor(address vaultAddress) Ownable(msg.sender) {
        vault = IPolicyVaultCore(vaultAddress);
    }

    modifier onlyTracker() {
        if (msg.sender != tracker) {
            revert OnlyTracker();
        }
        _;
    }

    modifier onlyOwnerOrTracker() {
        if (msg.sender != owner() && msg.sender != tracker) {
            revert OnlyOwnerOrTracker();
        }
        _;
    }

    modifier onlyClaimProcessor() {
        if (msg.sender != claimProcessor) {
            revert OnlyClaimProcessor();
        }
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
        uint256 maxPerPosition,
        uint256 poolLimit,
        uint256 referenceTVL
    ) external onlyOwner returns (uint256 productId) {
        productId = ++productCount;
        products[productId] = Product({
            id: productId,
            name: name,
            triggerType: TriggerType.RUG,
            triggerParams: abi.encode(RugParams({token: token, pool: pool, liquidityThreshold: liquidityThreshold})),
            premiumRateBps: premiumRateBps,
            duration: 0,
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
        if (!product.active) {
            revert ProductInactive();
        }
        if (coverageAmount > product.maxPerPosition) {
            revert CoverageTooHigh();
        }
        if (product.totalCommitted + coverageAmount > product.poolLimit) {
            revert PoolLimitReached();
        }
        if (vault.availableLiquidity() < coverageAmount) {
            revert InsufficientLiquidity();
        }

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
        vault.lockFunds(positionId, coverageAmount, premium);

        emit PositionCreated(positionId, msg.sender, productId, coverageAmount);
    }

    function expirePosition(uint256 positionId) external onlyTracker {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.ACTIVE) {
            revert PositionStateInvalid();
        }

        position.status = PositionStatus.EXPIRED;
        products[position.productId].totalCommitted -= position.coverageAmount;
        vault.unlockFunds(positionId);

        emit PositionExpired(positionId);
    }

    function initiateDepegClaim(uint256 positionId, uint256 observedPrice) external onlyTracker {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.ACTIVE) {
            revert PositionStateInvalid();
        }

        DepegParams memory params = abi.decode(
            products[position.productId].triggerParams,
            (DepegParams)
        );

        IAgentOrchestratorCore(agentOrchestrator).startDepegValidation(
            positionId,
            observedPrice,
            params.threshold,
            position.coverageAmount
        );
    }

    function initiateRugClaim(uint256 positionId, uint256 observedLiquidityPct) external onlyTracker {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.ACTIVE) {
            revert PositionStateInvalid();
        }

        RugParams memory params = abi.decode(
            products[position.productId].triggerParams,
            (RugParams)
        );

        IAgentOrchestratorCore(agentOrchestrator).startRugValidation(
            positionId,
            observedLiquidityPct,
            params.liquidityThreshold,
            position.coverageAmount
        );
    }

    function markClaimed(uint256 positionId, uint256 payout) external onlyClaimProcessor {
        Position storage position = positions[positionId];
        if (position.status != PositionStatus.ACTIVE) {
            revert PositionStateInvalid();
        }

        position.status = PositionStatus.CLAIMED;
        position.claimedPayout = payout;
        products[position.productId].totalCommitted -= position.coverageAmount;

        emit PositionClaimed(positionId, payout, position.claimedPrice);
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
        uint256 premium = (amount * product.premiumRateBps) / 10_000;

        if (product.duration > 1 days) {
          premium = (premium * product.duration) / 1 days;
        }

        if (premium < 1e6) {
            return 1e6;
        }

        return premium;
    }
}
