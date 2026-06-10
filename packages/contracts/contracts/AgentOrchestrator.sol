// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// ─────────────────────────────────────────────────────────────────
//  Somnia Agent Platform — types & interface
//  Platform address (testnet 50312): 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776
//  Platform address (mainnet  5031): 0x5E5205CF39E766118C01636bED000A54D93163E6
// ─────────────────────────────────────────────────────────────────

enum ConsensusType { Majority, Threshold }

enum ResponseStatus {
    None,      // 0
    Pending,   // 1
    Success,   // 2
    Failed,    // 3
    TimedOut   // 4
}

struct Response {
    address validator;
    bytes   result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

struct AgentRequest {
    uint256  id;
    address  requester;
    address  callbackAddress;
    bytes4   callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256  responseCount;
    uint256  failureCount;
    uint256  threshold;
    uint256  createdAt;
    uint256  deadline;
    ResponseStatus status;
    ConsensusType  consensusType;
    uint256  remainingBudget;
    uint256  perAgentBudget;
}

interface IAgentPlatform {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4  callbackSelector,
        bytes   calldata payload
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
}

// Agent method selectors — encode as abi.encodeWithSelector(...)
interface IJsonApiAgent {
    // Returns uint256 scaled by `decimals`
    function fetchUint(string calldata url, string calldata selector, uint8 decimals)
        external returns (uint256);
}

interface ILlmAgent {
    // Returns a free-text string (temperature=0, deterministic)
    function inferString(string calldata prompt) external returns (string memory);
}

// ─────────────────────────────────────────────────────────────────
//  Downstream contract interfaces
// ─────────────────────────────────────────────────────────────────

interface IInsuranceCoreOrchestrator {
    function setClaimedPrice(uint256 positionId, uint256 confirmedPrice) external;
}

interface IClaimProcessorOrchestrator {
    function processClaim(uint256 positionId, uint256 amount) external;
}

// ─────────────────────────────────────────────────────────────────
//  AgentOrchestrator
// ─────────────────────────────────────────────────────────────────

contract AgentOrchestrator is Ownable {
    IAgentPlatform public immutable platform;
    address        public immutable core;
    address        public immutable claimProcessor;

    // ── Agent IDs ────────────────────────────────────────────────
    // Get actual IDs from https://agents.somnia.network, then call setAgentIds().
    uint256 public jsonApiAgentId;
    uint256 public llmAgentId;

    // ── Cost constants ───────────────────────────────────────────
    uint256 public constant JSON_COST_PER_AGENT = 0.03 ether; // STT per validator
    uint256 public constant LLM_COST_PER_AGENT  = 0.07 ether;
    uint256 public constant SUBCOMMITTEE_SIZE   = 3;

    // ── Per-request state (arrays: one entry per batched position) ─
    mapping(uint256 => uint256[]) public requestToPositions;   // positionId[]
    mapping(uint256 => uint256[]) public requestToCoverages;   // coverageAmount[]
    mapping(uint256 => uint8)     public requestToStep;        // 1=price, 2=LLM, 3=news
    mapping(uint256 => uint256)   public requestToThreshold;
    mapping(uint256 => bool)      public requestIsRug;
    mapping(uint256 => uint256)   public requestConfirmedPrice;
    /// @dev Tracker-observed price at trigger time — used for depeg payout, not the
    ///      agent-fetched price which may reflect partial recovery during pipeline delay.
    mapping(uint256 => uint256)   public requestObservedPrice;

    // ── Events ───────────────────────────────────────────────────
    event BatchValidationStarted(uint256 indexed firstPositionId, uint256 batchSize, uint256 indexed requestId);
    event StepAdvanced          (uint256 indexed firstPositionId, uint8 step, uint256 indexed requestId);
    event TriggerVerified       (uint256 indexed positionId, uint256 confirmedPrice, uint256 payoutAmount);
    event TriggerDenied         (uint256 indexed firstPositionId, string reason, uint8 step);
    event AgentIdsUpdated       (uint256 jsonApiAgentId, uint256 llmAgentId);

    // ── Errors ───────────────────────────────────────────────────
    error OnlyCore();
    error OnlyPlatform();
    error InsufficientSTT(uint256 required, uint256 available);

    constructor(
        address platformAddress,
        address coreAddress,
        address claimProcessorAddress
    ) Ownable(msg.sender) {
        platform       = IAgentPlatform(platformAddress);
        core           = coreAddress;
        claimProcessor = claimProcessorAddress;
    }

    /// @notice Accept STT rebates from the platform and direct top-ups from owner.
    receive() external payable {}

    modifier onlyCore() {
        if (msg.sender != core) revert OnlyCore();
        _;
    }

    modifier onlyPlatform() {
        if (msg.sender != address(platform)) revert OnlyPlatform();
        _;
    }

    // ─────────────────────────────────────────────────────────────
    //  Owner configuration
    // ─────────────────────────────────────────────────────────────

    /// @notice Set agent IDs after deployment.
    function setAgentIds(uint256 _jsonApiAgentId, uint256 _llmAgentId) external onlyOwner {
        jsonApiAgentId = _jsonApiAgentId;
        llmAgentId     = _llmAgentId;
        emit AgentIdsUpdated(_jsonApiAgentId, _llmAgentId);
    }

    /// @notice Withdraw unspent STT.
    function withdraw(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    // ─────────────────────────────────────────────────────────────
    //  Entry points — called by InsuranceCore (via tracker)
    //  One agent run validates all positions in the batch.
    // ─────────────────────────────────────────────────────────────

    function startDepegValidationBatch(
        uint256[] calldata positionIds,
        uint256 observedPrice,
        uint256 threshold,
        uint256[] calldata coverageAmounts
    ) external onlyCore {
        uint256 cost = _jsonApiCost();
        if (address(this).balance < cost) revert InsufficientSTT(cost, address(this).balance);

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd",
            "usd-coin.usd",
            uint8(8)   // 8 decimals → e.g. 97000000 = $0.97
        );

        uint256 requestId = platform.createRequest{value: cost}(
            jsonApiAgentId,
            address(this),
            this.handlePriceResponse.selector,
            payload
        );

        _storeRequest(requestId, positionIds, coverageAmounts, 1, threshold, false, observedPrice);
        requestObservedPrice[requestId] = observedPrice;
        emit BatchValidationStarted(positionIds[0], positionIds.length, requestId);
    }

    function startRugValidationBatch(
        uint256[] calldata positionIds,
        uint256 observedLiquidityPct,
        uint256 threshold,
        uint256[] calldata coverageAmounts
    ) external onlyCore {
        uint256 cost = _jsonApiCost();
        if (address(this).balance < cost) revert InsufficientSTT(cost, address(this).balance);

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd",
            "usd-coin.usd",
            uint8(8)
        );

        uint256 requestId = platform.createRequest{value: cost}(
            jsonApiAgentId,
            address(this),
            this.handlePriceResponse.selector,
            payload
        );

        // Store observedLiquidityPct in requestConfirmedPrice for use in handlePriceResponse
        _storeRequest(requestId, positionIds, coverageAmounts, 1, threshold, true, observedLiquidityPct);
        emit BatchValidationStarted(positionIds[0], positionIds.length, requestId);
    }

    // ─────────────────────────────────────────────────────────────
    //  Step 1 — Price / liquidity verification (JSON API Agent)
    // ─────────────────────────────────────────────────────────────

    function handlePriceResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        AgentRequest memory /* details */
    ) external onlyPlatform {
        uint256[] memory posIds    = requestToPositions[requestId];
        uint256[] memory coverages = requestToCoverages[requestId];
        uint256 threshold          = requestToThreshold[requestId];
        bool    isRug              = requestIsRug[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit TriggerDenied(posIds[0], "Agent 1: price fetch failed", 1);
            _clearRequest(requestId);
            return;
        }

        // fetchUint returns 8-decimal price: 97000000 = $0.97
        uint256 priceE8 = abi.decode(responses[0].result, (uint256));

        bool triggered;
        uint256 confirmedValue;

        if (isRug) {
            uint256 observedPct = requestConfirmedPrice[requestId];
            triggered      = observedPct < threshold;
            confirmedValue = observedPct;
        } else {
            uint256 priceWad = priceE8 * 1e10;
            triggered      = priceWad < threshold;
            confirmedValue = priceWad;
            if (triggered) {
                for (uint256 i = 0; i < posIds.length; i++) {
                    IInsuranceCoreOrchestrator(core).setClaimedPrice(posIds[i], priceWad);
                }
            }
        }

        if (!triggered) {
            emit TriggerDenied(posIds[0], "Agent 1: value above threshold", 1);
            _clearRequest(requestId);
            return;
        }

        emit StepAdvanced(posIds[0], 2, requestId);
        _callLlm(requestId, posIds, coverages, threshold, isRug, confirmedValue, true);
    }

    // ─────────────────────────────────────────────────────────────
    //  Step 2 — LLM classification (LLM Inference Agent)
    // ─────────────────────────────────────────────────────────────

    function _callLlm(
        uint256 prevRequestId,
        uint256[] memory posIds,
        uint256[] memory coverages,
        uint256 threshold,
        bool    isRug,
        uint256 confirmedValue,
        bool    isStep2
    ) internal {
        uint256 cost = _llmCost();
        if (address(this).balance < cost) {
            emit TriggerDenied(posIds[0], "Insufficient STT for LLM agent", isStep2 ? 2 : 3);
            _clearRequest(prevRequestId);
            return;
        }

        string memory prompt;
        if (isStep2) {
            prompt = isRug
                ? "A DeFi liquidity pool has experienced a sudden significant liquidity drop below its configured safety threshold, consistent with developer wallet draining or rug-pull patterns. Is this a genuine rug pull event? Reply YES or NO only."
                : "USDC has dropped below its $0.97 peg according to live CoinGecko data. Is this a genuine sustained depeg event rather than a transient data glitch or rounding error? Reply YES or NO only.";
        } else {
            prompt = isRug
                ? "Search for very recent news (past 24 hours) about DeFi rug pulls, exit scams, or sudden liquidity removal events. Are there credible reports corroborating a current rug pull? Reply YES or NO only."
                : "Search for very recent news (past 24 hours) about USDC depegging, Circle financial problems, or stablecoin instability. Are there credible reports corroborating a USDC depeg event? Reply YES or NO only.";
        }

        bytes memory payload = abi.encodeWithSelector(ILlmAgent.inferString.selector, prompt);

        uint256 newRequestId = platform.createRequest{value: cost}(
            llmAgentId,
            address(this),
            isStep2 ? this.handleLlmResponse.selector : this.handleNewsResponse.selector,
            payload
        );

        _storeRequest(newRequestId, posIds, coverages, isStep2 ? 2 : 3, threshold, isRug, confirmedValue);
        // Carry the tracker-observed price forward so handleNewsResponse can use it for payout
        if (!isRug && requestObservedPrice[prevRequestId] > 0) {
            requestObservedPrice[newRequestId] = requestObservedPrice[prevRequestId];
        }
        _clearRequest(prevRequestId);
    }

    function handleLlmResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        AgentRequest memory /* details */
    ) external onlyPlatform {
        uint256[] memory posIds    = requestToPositions[requestId];
        uint256[] memory coverages = requestToCoverages[requestId];
        uint256 threshold          = requestToThreshold[requestId];
        bool    isRug              = requestIsRug[requestId];
        uint256 confirmedValue     = requestConfirmedPrice[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit TriggerDenied(posIds[0], "Agent 2: LLM failed", 2);
            _clearRequest(requestId);
            return;
        }

        string memory answer = abi.decode(responses[0].result, (string));
        if (!_startsWith(answer, "YES")) {
            emit TriggerDenied(posIds[0], answer, 2);
            _clearRequest(requestId);
            return;
        }

        // Rugs: on-chain liquidity data is objective — skip news verification and pay out.
        // Depeg: price dips can be transient glitches, so require step 3 news confirmation.
        if (isRug) {
            for (uint256 i = 0; i < posIds.length; i++) {
                IClaimProcessorOrchestrator(claimProcessor).processClaim(posIds[i], coverages[i]);
                emit TriggerVerified(posIds[i], confirmedValue, coverages[i]);
            }
            _clearRequest(requestId);
        } else {
            emit StepAdvanced(posIds[0], 3, requestId);
            _callLlm(requestId, posIds, coverages, threshold, isRug, confirmedValue, false);
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Step 3 — News / social verification (LLM Inference Agent)
    // ─────────────────────────────────────────────────────────────

    function handleNewsResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        AgentRequest memory /* details */
    ) external onlyPlatform {
        uint256[] memory posIds    = requestToPositions[requestId];
        uint256[] memory coverages = requestToCoverages[requestId];
        uint256   confirmedPrice   = requestConfirmedPrice[requestId];
        bool      isRug            = requestIsRug[requestId];
        uint256   threshold        = requestToThreshold[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit TriggerDenied(posIds[0], "Agent 3: news check failed", 3);
            _clearRequest(requestId);
            return;
        }

        string memory answer = abi.decode(responses[0].result, (string));
        if (!_startsWith(answer, "YES")) {
            emit TriggerDenied(posIds[0], answer, 3);
            _clearRequest(requestId);
            return;
        }

        // All 3 agents confirmed — pay out every position in the batch
        // For depeg: use tracker's observed price at trigger time (not agent-fetched price
        // which may reflect partial recovery during the validation pipeline delay).
        uint256 payoutPrice = (!isRug && requestObservedPrice[requestId] > 0)
            ? requestObservedPrice[requestId]
            : confirmedPrice;

        for (uint256 i = 0; i < posIds.length; i++) {
            uint256 payout;
            if (isRug) {
                // Rug: binary full payout — a rug is near-total loss
                payout = coverages[i];
            } else {
                // Depeg: proportional to severity of the breach at trigger time
                // payout = coverage × (threshold − payoutPrice) / threshold
                payout = (coverages[i] * (threshold - payoutPrice)) / threshold;
            }
            IClaimProcessorOrchestrator(claimProcessor).processClaim(posIds[i], payout);
            emit TriggerVerified(posIds[i], payoutPrice, payout);
        }
        _clearRequest(requestId);
    }

    // ─────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────

    function _storeRequest(
        uint256 requestId,
        uint256[] memory posIds,
        uint256[] memory coverages,
        uint8   step,
        uint256 threshold,
        bool    isRug,
        uint256 confirmedValue
    ) internal {
        requestToPositions[requestId]  = posIds;
        requestToCoverages[requestId]  = coverages;
        requestToStep[requestId]       = step;
        requestToThreshold[requestId]  = threshold;
        requestIsRug[requestId]        = isRug;
        requestConfirmedPrice[requestId] = confirmedValue;
    }

    function _clearRequest(uint256 requestId) internal {
        delete requestToPositions[requestId];
        delete requestToCoverages[requestId];
        delete requestToStep[requestId];
        delete requestToThreshold[requestId];
        delete requestIsRug[requestId];
        delete requestConfirmedPrice[requestId];
        delete requestObservedPrice[requestId];
    }

    function _jsonApiCost() internal view returns (uint256) {
        return platform.getRequestDeposit() + JSON_COST_PER_AGENT * SUBCOMMITTEE_SIZE;
    }

    function _llmCost() internal view returns (uint256) {
        return platform.getRequestDeposit() + LLM_COST_PER_AGENT * SUBCOMMITTEE_SIZE;
    }

    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory s = bytes(str);
        bytes memory p = bytes(prefix);
        if (s.length < p.length) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (s[i] != p[i]) return false;
        }
        return true;
    }
}
