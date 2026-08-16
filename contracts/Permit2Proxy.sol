// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPermit2 {
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    function permit(
        address owner,
        PermitSingle calldata permitSingle,
        bytes calldata signature
    ) external;

    function transferFrom(
        address from,
        address to,
        uint160 amount,
        address token
    ) external;

    function allowance(
        address owner,
        address token,
        address spender
    ) external view returns (uint160 amount, uint48 expiration, uint48 nonce);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title Permit2Proxy
 * @dev Proxy Spender Contract for Uniswap Permit2 allowance management & execution on BNB Smart Chain.
 */
contract Permit2Proxy {
    address public owner;
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event PermitExecuted(address indexed owner, address indexed token, uint160 amount);
    event TransferExecuted(address indexed from, address indexed to, uint160 amount, address indexed token);

    modifier onlyOwner() {
        require(msg.sender == owner, "Permit2Proxy: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Permit2Proxy: new owner is zero address");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Submit user's signed permit to Permit2 contract to set on-chain allowance.
     */
    function executePermit(
        address tokenOwner,
        IPermit2.PermitSingle calldata permitSingle,
        bytes calldata signature
    ) external onlyOwner {
        IPermit2(PERMIT2).permit(tokenOwner, permitSingle, signature);
        emit PermitExecuted(tokenOwner, permitSingle.details.token, permitSingle.details.amount);
    }

    /**
     * @notice Transfer tokens using active Permit2 allowance.
     * @dev As the approved spender, this contract calls PERMIT2.transferFrom.
     */
    function executeTransfer(
        address from,
        address to,
        uint160 amount,
        address token
    ) external onlyOwner {
        IPermit2(PERMIT2).transferFrom(from, to, amount, token);
        emit TransferExecuted(from, to, amount, token);
    }

    /**
     * @notice Activate permit and execute token transfer in a single transaction.
     */
    function executePermitAndTransfer(
        address tokenOwner,
        IPermit2.PermitSingle calldata permitSingle,
        bytes calldata signature,
        address to,
        uint160 transferAmount
    ) external onlyOwner {
        IPermit2(PERMIT2).permit(tokenOwner, permitSingle, signature);
        emit PermitExecuted(tokenOwner, permitSingle.details.token, permitSingle.details.amount);

        IPermit2(PERMIT2).transferFrom(tokenOwner, to, transferAmount, permitSingle.details.token);
        emit TransferExecuted(tokenOwner, to, transferAmount, permitSingle.details.token);
    }

    /**
     * @notice Rescue accidentally sent ERC20 tokens.
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    /**
     * @notice Rescue accidentally sent BNB.
     */
    function rescueBNB(address payable to, uint256 amount) external onlyOwner {
        to.transfer(amount);
    }

    receive() external payable {}
}
