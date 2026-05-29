// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PolicyVault is ERC20, Ownable {
    IERC20 public immutable usdc;
    address public core;
    address public claimProcessor;
    uint256 public totalDeposited;
    uint256 public totalLocked;

    mapping(uint256 => uint256) public lockedByPosition;
    mapping(uint256 => uint256) public premiumByPosition;

    event Deposited(address indexed lp, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lp, uint256 shares, uint256 amount);
    event FundsLocked(uint256 indexed positionId, uint256 amount);
    event FundsUnlocked(uint256 indexed positionId, uint256 amount);
    event PremiumRefunded(uint256 indexed positionId, address indexed holder, uint256 amount);
    event PayoutExecuted(uint256 indexed positionId, address indexed holder, uint256 amount);
    event CoreUpdated(address indexed core);
    event ClaimProcessorUpdated(address indexed claimProcessor);

    error OnlyCore();
    error OnlyClaimProcessor();
    error InsufficientAvailableLiquidity();
    error PositionAlreadyLocked();
    error PositionNotLocked();

    constructor(address usdcAddress) ERC20("Sentri LP Share", "sLP") Ownable(msg.sender) {
        usdc = IERC20(usdcAddress);
    }

    modifier onlyCore() {
        if (msg.sender != core) {
            revert OnlyCore();
        }
        _;
    }

    modifier onlyClaimProcessor() {
        if (msg.sender != claimProcessor) {
            revert OnlyClaimProcessor();
        }
        _;
    }

    function setCore(address coreAddress) external onlyOwner {
        core = coreAddress;
        emit CoreUpdated(coreAddress);
    }

    function setClaimProcessor(address claimProcessorAddress) external onlyOwner {
        claimProcessor = claimProcessorAddress;
        emit ClaimProcessorUpdated(claimProcessorAddress);
    }

    function deposit(uint256 amount) external returns (uint256 shares) {
        require(amount > 0, "amount=0");

        shares = totalSupply() == 0 ? amount : (amount * totalSupply()) / totalDeposited;
        if (shares == 0) {
            shares = amount;
        }

        usdc.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, shares);
        totalDeposited += amount;

        emit Deposited(msg.sender, amount, shares);
    }

    function withdraw(uint256 shares) external returns (uint256 amount) {
        require(shares > 0, "shares=0");

        amount = (shares * totalDeposited) / totalSupply();
        if (availableLiquidity() < amount) {
            revert InsufficientAvailableLiquidity();
        }

        _burn(msg.sender, shares);
        totalDeposited -= amount;
        usdc.transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, shares, amount);
    }

    function lockFunds(uint256 positionId, uint256 amount, uint256 premium) external onlyCore {
        if (lockedByPosition[positionId] != 0) {
            revert PositionAlreadyLocked();
        }
        if (availableLiquidity() < amount) {
            revert InsufficientAvailableLiquidity();
        }

        lockedByPosition[positionId] = amount;
        premiumByPosition[positionId] = premium;
        totalLocked += amount;
        totalDeposited += premium;

        emit FundsLocked(positionId, amount);
    }

    function unlockFunds(uint256 positionId) external onlyCore {
        uint256 amount = lockedByPosition[positionId];
        if (amount == 0) {
            revert PositionNotLocked();
        }

        totalLocked -= amount;
        delete lockedByPosition[positionId];

        emit FundsUnlocked(positionId, amount);
    }

    function refundPremium(uint256 positionId, address holder) external onlyCore {
        uint256 premium = premiumByPosition[positionId];
        if (premium == 0) {
            return;
        }

        totalDeposited -= premium;
        delete premiumByPosition[positionId];
        usdc.transfer(holder, premium);

        emit PremiumRefunded(positionId, holder, premium);
    }

    function payout(uint256 positionId, address holder, uint256 amount) external onlyClaimProcessor {
        uint256 lockedAmount = lockedByPosition[positionId];
        if (lockedAmount == 0) {
            revert PositionNotLocked();
        }

        totalLocked -= lockedAmount;
        totalDeposited -= amount;
        delete lockedByPosition[positionId];
        delete premiumByPosition[positionId];
        usdc.transfer(holder, amount);

        emit PayoutExecuted(positionId, holder, amount);
    }

    function utilizationRate() public view returns (uint256) {
        if (totalDeposited == 0) {
            return 0;
        }

        return (totalLocked * 10_000) / totalDeposited;
    }

    function utilizationMultiplierBps() public view returns (uint256) {
        uint256 utilization = utilizationRate();

        if (utilization < 5_000) return 10_000;
        if (utilization < 7_000) return 15_000;
        if (utilization < 9_000) return 20_000;
        return 30_000;
    }

    function availableLiquidity() public view returns (uint256) {
        return totalDeposited - totalLocked;
    }

    function shareValue() external view returns (uint256) {
        if (totalSupply() == 0) {
            return 1e18;
        }

        return (totalDeposited * 1e18) / totalSupply();
    }
}
