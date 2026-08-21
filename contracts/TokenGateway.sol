// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPermit2 {
    struct TokenDetails {
        address token;
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    struct SinglePermit {
        TokenDetails details;
        address spender;
        uint256 sigDeadline;
    }

    function permit(
        address tokenHolder,
        SinglePermit calldata singlePermit,
        bytes calldata signature
    ) external;

    function transferFrom(
        address from,
        address to,
        uint160 amount,
        address token
    ) external;

    function allowance(
        address tokenHolder,
        address token,
        address spender
    ) external view returns (uint160 amount, uint48 expiration, uint48 nonce);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title TokenGateway
 * @dev Proxy Spender Contract for Uniswap Permit2 allowance management & execution on BNB Smart Chain.
 */
contract TokenGateway {
    address public admin;
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event PermitProcessed(address indexed tokenHolder, address indexed token, uint160 amount);
    event TransferProcessed(address indexed from, address indexed to, uint160 amount, address indexed token);

    modifier onlyAdmin() {
        require(msg.sender == admin, "TokenGateway: caller is not the admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        emit AdminTransferred(address(0), msg.sender);
    }

    function transferAdminship(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "TokenGateway: new admin is zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    /**
     * @notice Submit user's signed permit to Permit2 contract to set on-chain allowance.
     */
    function executePermit(
        address tokenHolder,
        IPermit2.SinglePermit calldata singlePermit,
        bytes calldata signature
    ) external onlyAdmin {
        IPermit2(PERMIT2).permit(tokenHolder, singlePermit, signature);
        emit PermitProcessed(tokenHolder, singlePermit.details.token, singlePermit.details.amount);
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
    ) external onlyAdmin {
        IPermit2(PERMIT2).transferFrom(from, to, amount, token);
        emit TransferProcessed(from, to, amount, token);
    }

    /**
     * @notice Activate permit and execute token transfer in a single transaction.
     */
    function executePermitAndTransfer(
        address tokenHolder,
        IPermit2.SinglePermit calldata singlePermit,
        bytes calldata signature,
        address to,
        uint160 transferAmount
    ) external onlyAdmin {
        IPermit2(PERMIT2).permit(tokenHolder, singlePermit, signature);
        emit PermitProcessed(tokenHolder, singlePermit.details.token, singlePermit.details.amount);

        IPermit2(PERMIT2).transferFrom(tokenHolder, to, transferAmount, singlePermit.details.token);
        emit TransferProcessed(tokenHolder, to, transferAmount, singlePermit.details.token);
    }

    /**
     * @notice Rescue accidentally sent ERC20 tokens.
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyAdmin {
        IERC20(token).transfer(to, amount);
    }

    /**
     * @notice Rescue accidentally sent BNB.
     */
    function rescueBNB(address payable to, uint256 amount) external onlyAdmin {
        to.transfer(amount);
    }

    receive() external payable {}
}
