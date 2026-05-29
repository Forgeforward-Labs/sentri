// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IInsuranceCoreClaims {
    function markClaimed(uint256 positionId, uint256 payout) external;
    function positionHolder(uint256 positionId) external view returns (address);
}

interface IPolicyVaultClaims {
    function payout(uint256 positionId, address holder, uint256 amount) external;
}

contract ClaimProcessor is Ownable {
    address public immutable core;
    address public immutable vault;
    address public agentOrchestrator;

    mapping(uint256 => bool) public processedClaims;

    event ClaimProcessed(uint256 indexed positionId, address indexed holder, uint256 amount);
    event AgentOrchestratorUpdated(address indexed agentOrchestrator);

    error OnlyAgentOrchestrator();
    error ClaimAlreadyProcessed();

    constructor(address coreAddress, address vaultAddress) Ownable(msg.sender) {
        core = coreAddress;
        vault = vaultAddress;
    }

    modifier onlyAgentOrchestrator() {
        if (msg.sender != agentOrchestrator) {
            revert OnlyAgentOrchestrator();
        }
        _;
    }

    function setAgentOrchestrator(address agentOrchestratorAddress) external onlyOwner {
        agentOrchestrator = agentOrchestratorAddress;
        emit AgentOrchestratorUpdated(agentOrchestratorAddress);
    }

    function processClaim(uint256 positionId, uint256 amount) external onlyAgentOrchestrator {
        if (processedClaims[positionId]) {
            revert ClaimAlreadyProcessed();
        }

        processedClaims[positionId] = true;

        address holder = IInsuranceCoreClaims(core).positionHolder(positionId);
        IInsuranceCoreClaims(core).markClaimed(positionId, amount);
        IPolicyVaultClaims(vault).payout(positionId, holder, amount);

        emit ClaimProcessed(positionId, holder, amount);
    }
}
