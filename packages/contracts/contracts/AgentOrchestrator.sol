// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IInsuranceCoreOrchestrator {
    function setClaimedPrice(uint256 positionId, uint256 confirmedPrice) external;
}

interface IClaimProcessorOrchestrator {
    function processClaim(uint256 positionId, uint256 amount) external;
}

contract AgentOrchestrator is Ownable {
    address public immutable core;
    address public immutable claimProcessor;
    address public somniaAgents;

    mapping(bytes32 => uint256) public requestToPosition;
    mapping(bytes32 => uint8) public requestToStep;

    event Agent1Called(uint256 indexed positionId, bytes32 indexed requestId);
    event Agent2Called(uint256 indexed positionId, bytes32 indexed requestId);
    event Agent3Called(uint256 indexed positionId, bytes32 indexed requestId);
    event TriggerVerified(uint256 indexed positionId, uint256 confirmedPrice, uint256 payoutAmount);
    event TriggerDenied(uint256 indexed positionId, string reason, uint8 step);
    event SomniaAgentsUpdated(address indexed somniaAgents);

    error OnlyCore();
    error OnlySomniaAgents();

    constructor(address coreAddress, address claimProcessorAddress, address somniaAgentsAddress)
        Ownable(msg.sender)
    {
        core = coreAddress;
        claimProcessor = claimProcessorAddress;
        somniaAgents = somniaAgentsAddress;
    }

    modifier onlyCore() {
        if (msg.sender != core) {
            revert OnlyCore();
        }
        _;
    }

    modifier onlySomniaAgents() {
        if (msg.sender != somniaAgents) {
            revert OnlySomniaAgents();
        }
        _;
    }

    function setSomniaAgents(address somniaAgentsAddress) external onlyOwner {
        somniaAgents = somniaAgentsAddress;
        emit SomniaAgentsUpdated(somniaAgentsAddress);
    }

    function startDepegValidation(uint256 positionId, uint256 observedPrice)
        external
        onlyCore
        returns (bytes32 requestId)
    {
        requestId = keccak256(abi.encode(positionId, observedPrice, block.timestamp, "DEPEG"));
        requestToPosition[requestId] = positionId;
        requestToStep[requestId] = 1;

        emit Agent1Called(positionId, requestId);
    }

    function startRugValidation(uint256 positionId, uint256 observedLiquidityPct)
        external
        onlyCore
        returns (bytes32 requestId)
    {
        requestId = keccak256(abi.encode(positionId, observedLiquidityPct, block.timestamp, "RUG"));
        requestToPosition[requestId] = positionId;
        requestToStep[requestId] = 1;

        emit Agent1Called(positionId, requestId);
    }

    function agent1Callback(bytes32 requestId, uint256 confirmedPrice, uint256 threshold)
        external
        onlySomniaAgents
    {
        uint256 positionId = requestToPosition[requestId];

        if (confirmedPrice >= threshold) {
            emit TriggerDenied(positionId, "Agent 1 denied trigger", 1);
            _clearRequest(requestId);
            return;
        }

        IInsuranceCoreOrchestrator(core).setClaimedPrice(positionId, confirmedPrice);
        requestToStep[requestId] = 2;
        emit Agent2Called(positionId, requestId);
    }

    function agent2Callback(bytes32 requestId, bool valid, string calldata reason)
        external
        onlySomniaAgents
    {
        uint256 positionId = requestToPosition[requestId];

        if (!valid) {
            emit TriggerDenied(positionId, reason, 2);
            _clearRequest(requestId);
            return;
        }

        requestToStep[requestId] = 3;
        emit Agent3Called(positionId, requestId);
    }

    function agent3Callback(bytes32 requestId, bool confirmed, uint256 payoutAmount, string calldata reason)
        external
        onlySomniaAgents
    {
        uint256 positionId = requestToPosition[requestId];

        if (!confirmed) {
            emit TriggerDenied(positionId, reason, 3);
            _clearRequest(requestId);
            return;
        }

        IClaimProcessorOrchestrator(claimProcessor).processClaim(positionId, payoutAmount);
        emit TriggerVerified(positionId, 0, payoutAmount);
        _clearRequest(requestId);
    }

    function _clearRequest(bytes32 requestId) internal {
        delete requestToPosition[requestId];
        delete requestToStep[requestId];
    }
}
