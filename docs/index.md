# Solidity API

## Ownable

Contract module which provides a basic access control mechanism, where
there is an account (an owner) that can be granted exclusive access to
specific functions.

By default, the owner account will be the one that deploys the contract. This
can later be changed with {transferOwnership}.

This module is used through inheritance. It will make available the modifier
&#x60;onlyOwner&#x60;, which can be applied to your functions to restrict their use to
the owner._

### _owner

```solidity
address _owner
```

### OwnershipTransferred

```solidity
event OwnershipTransferred(address previousOwner, address newOwner)
```

### constructor

```solidity
constructor() internal
```

_Initializes the contract setting the deployer as the initial owner._

### owner

```solidity
function owner() public view virtual returns (address)
```

_Returns the address of the current owner._

### onlyOwner

```solidity
modifier onlyOwner()
```

_Throws if called by any account other than the owner._

### renounceOwnership

```solidity
function renounceOwnership() public virtual
```

_Leaves the contract without owner. It will not be possible to call
&#x60;onlyOwner&#x60; functions anymore. Can only be called by the current owner.

NOTE: Renouncing ownership will leave the contract without an owner,
thereby removing any functionality that is only available to the owner._

### transferOwnership

```solidity
function transferOwnership(address newOwner) public virtual
```

_Transfers ownership of the contract to a new account (&#x60;newOwner&#x60;).
Can only be called by the current owner._

### _transferOwnership

```solidity
function _transferOwnership(address newOwner) internal virtual
```

_Transfers ownership of the contract to a new account (&#x60;newOwner&#x60;).
Internal function without access restriction._

## ERC20

_Implementation of the {IERC20} interface.

This implementation is agnostic to the way tokens are created. This means
that a supply mechanism has to be added in a derived contract using {_mint}.
For a generic mechanism see {ERC20PresetMinterPauser}.

TIP: For a detailed writeup see our guide
https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226[How
to implement supply mechanisms].

We have followed general OpenZeppelin Contracts guidelines: functions revert
instead returning &#x60;false&#x60; on failure. This behavior is nonetheless
conventional and does not conflict with the expectations of ERC20
applications.

Additionally, an {Approval} event is emitted on calls to {transferFrom}.
This allows applications to reconstruct the allowance for all accounts just
by listening to said events. Other implementations of the EIP may not emit
these events, as it isn&#x27;t required by the specification.

Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
functions have been added to mitigate the well-known issues around setting
allowances. See {IERC20-approve}._

### _balances

```solidity
mapping(address &#x3D;&gt; uint256) _balances
```

### _allowances

```solidity
mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) _allowances
```

### _totalSupply

```solidity
uint256 _totalSupply
```

### _name

```solidity
string _name
```

### _symbol

```solidity
string _symbol
```

### constructor

```solidity
constructor(string name_, string symbol_) public
```

_Sets the values for {name} and {symbol}.

The default value of {decimals} is 18. To select a different value for
{decimals} you should overload it.

All two of these values are immutable: they can only be set once during
construction._

### name

```solidity
function name() public view virtual returns (string)
```

_Returns the name of the token._

### symbol

```solidity
function symbol() public view virtual returns (string)
```

_Returns the symbol of the token, usually a shorter version of the
name._

### decimals

```solidity
function decimals() public view virtual returns (uint8)
```

_Returns the number of decimals used to get its user representation.
For example, if &#x60;decimals&#x60; equals &#x60;2&#x60;, a balance of &#x60;505&#x60; tokens should
be displayed to a user as &#x60;5.05&#x60; (&#x60;505 / 10 ** 2&#x60;).

Tokens usually opt for a value of 18, imitating the relationship between
Ether and Wei. This is the value {ERC20} uses, unless this function is
overridden;

NOTE: This information is only used for _display_ purposes: it in
no way affects any of the arithmetic of the contract, including
{IERC20-balanceOf} and {IERC20-transfer}._

### totalSupply

```solidity
function totalSupply() public view virtual returns (uint256)
```

_See {IERC20-totalSupply}._

### balanceOf

```solidity
function balanceOf(address account) public view virtual returns (uint256)
```

_See {IERC20-balanceOf}._

### transfer

```solidity
function transfer(address recipient, uint256 amount) public virtual returns (bool)
```

_See {IERC20-transfer}.

Requirements:

- &#x60;recipient&#x60; cannot be the zero address.
- the caller must have a balance of at least &#x60;amount&#x60;._

### allowance

```solidity
function allowance(address owner, address spender) public view virtual returns (uint256)
```

_See {IERC20-allowance}._

### approve

```solidity
function approve(address spender, uint256 amount) public virtual returns (bool)
```

_See {IERC20-approve}.

Requirements:

- &#x60;spender&#x60; cannot be the zero address._

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) public virtual returns (bool)
```

_See {IERC20-transferFrom}.

Emits an {Approval} event indicating the updated allowance. This is not
required by the EIP. See the note at the beginning of {ERC20}.

Requirements:

- &#x60;sender&#x60; and &#x60;recipient&#x60; cannot be the zero address.
- &#x60;sender&#x60; must have a balance of at least &#x60;amount&#x60;.
- the caller must have allowance for &#x60;&#x60;sender&#x60;&#x60;&#x27;s tokens of at least
&#x60;amount&#x60;._

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool)
```

_Atomically increases the allowance granted to &#x60;spender&#x60; by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- &#x60;spender&#x60; cannot be the zero address._

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool)
```

_Atomically decreases the allowance granted to &#x60;spender&#x60; by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- &#x60;spender&#x60; cannot be the zero address.
- &#x60;spender&#x60; must have allowance for the caller of at least
&#x60;subtractedValue&#x60;._

### _transfer

```solidity
function _transfer(address sender, address recipient, uint256 amount) internal virtual
```

_Moves &#x60;amount&#x60; of tokens from &#x60;sender&#x60; to &#x60;recipient&#x60;.

This internal function is equivalent to {transfer}, and can be used to
e.g. implement automatic token fees, slashing mechanisms, etc.

Emits a {Transfer} event.

Requirements:

- &#x60;sender&#x60; cannot be the zero address.
- &#x60;recipient&#x60; cannot be the zero address.
- &#x60;sender&#x60; must have a balance of at least &#x60;amount&#x60;._

### _mint

```solidity
function _mint(address account, uint256 amount) internal virtual
```

_Creates &#x60;amount&#x60; tokens and assigns them to &#x60;account&#x60;, increasing
the total supply.

Emits a {Transfer} event with &#x60;from&#x60; set to the zero address.

Requirements:

- &#x60;account&#x60; cannot be the zero address._

### _burn

```solidity
function _burn(address account, uint256 amount) internal virtual
```

_Destroys &#x60;amount&#x60; tokens from &#x60;account&#x60;, reducing the
total supply.

Emits a {Transfer} event with &#x60;to&#x60; set to the zero address.

Requirements:

- &#x60;account&#x60; cannot be the zero address.
- &#x60;account&#x60; must have at least &#x60;amount&#x60; tokens._

### _approve

```solidity
function _approve(address owner, address spender, uint256 amount) internal virtual
```

_Sets &#x60;amount&#x60; as the allowance of &#x60;spender&#x60; over the &#x60;owner&#x60; s tokens.

This internal function is equivalent to &#x60;approve&#x60;, and can be used to
e.g. set automatic allowances for certain subsystems, etc.

Emits an {Approval} event.

Requirements:

- &#x60;owner&#x60; cannot be the zero address.
- &#x60;spender&#x60; cannot be the zero address._

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual
```

_Hook that is called before any transfer of tokens. This includes
minting and burning.

Calling conditions:

- when &#x60;from&#x60; and &#x60;to&#x60; are both non-zero, &#x60;amount&#x60; of &#x60;&#x60;from&#x60;&#x60;&#x27;s tokens
will be transferred to &#x60;to&#x60;.
- when &#x60;from&#x60; is zero, &#x60;amount&#x60; tokens will be minted for &#x60;to&#x60;.
- when &#x60;to&#x60; is zero, &#x60;amount&#x60; of &#x60;&#x60;from&#x60;&#x60;&#x27;s tokens will be burned.
- &#x60;from&#x60; and &#x60;to&#x60; are never both zero.

To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks]._

### _afterTokenTransfer

```solidity
function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual
```

_Hook that is called after any transfer of tokens. This includes
minting and burning.

Calling conditions:

- when &#x60;from&#x60; and &#x60;to&#x60; are both non-zero, &#x60;amount&#x60; of &#x60;&#x60;from&#x60;&#x60;&#x27;s tokens
has been transferred to &#x60;to&#x60;.
- when &#x60;from&#x60; is zero, &#x60;amount&#x60; tokens have been minted for &#x60;to&#x60;.
- when &#x60;to&#x60; is zero, &#x60;amount&#x60; of &#x60;&#x60;from&#x60;&#x60;&#x27;s tokens have been burned.
- &#x60;from&#x60; and &#x60;to&#x60; are never both zero.

To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks]._

## IERC20

_Interface of the ERC20 standard as defined in the EIP._

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

_Returns the amount of tokens in existence._

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

_Returns the amount of tokens owned by &#x60;account&#x60;._

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

_Moves &#x60;amount&#x60; tokens from the caller&#x27;s account to &#x60;recipient&#x60;.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```

_Returns the remaining number of tokens that &#x60;spender&#x60; will be
allowed to spend on behalf of &#x60;owner&#x60; through {transferFrom}. This is
zero by default.

This value changes when {approve} or {transferFrom} are called._

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```

_Sets &#x60;amount&#x60; as the allowance of &#x60;spender&#x60; over the caller&#x27;s tokens.

Returns a boolean value indicating whether the operation succeeded.

IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender&#x27;s allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

Emits an {Approval} event._

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

_Moves &#x60;amount&#x60; tokens from &#x60;sender&#x60; to &#x60;recipient&#x60; using the
allowance mechanism. &#x60;amount&#x60; is then deducted from the caller&#x27;s
allowance.

Returns a boolean value indicating whether the operation succeeded.

Emits a {Transfer} event._

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

_Emitted when &#x60;value&#x60; tokens are moved from one account (&#x60;from&#x60;) to
another (&#x60;to&#x60;).

Note that &#x60;value&#x60; may be zero._

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

_Emitted when the allowance of a &#x60;spender&#x60; for an &#x60;owner&#x60; is set by
a call to {approve}. &#x60;value&#x60; is the new allowance._

## IERC20Metadata

_Interface for the optional metadata functions from the ERC20 standard.

_Available since v4.1.__

### name

```solidity
function name() external view returns (string)
```

_Returns the name of the token._

### symbol

```solidity
function symbol() external view returns (string)
```

_Returns the symbol of the token._

### decimals

```solidity
function decimals() external view returns (uint8)
```

_Returns the decimals places of the token._

## Context

_Provides information about the current execution context, including the
sender of the transaction and its data. While these are generally available
via msg.sender and msg.data, they should not be accessed in such a direct
manner, since when dealing with meta-transactions the account sending and
paying for execution may not be the actual sender (as far as an application
is concerned).

This contract is only required for intermediate, library-like contracts._

### _msgSender

```solidity
function _msgSender() internal view virtual returns (address)
```

### _msgData

```solidity
function _msgData() internal view virtual returns (bytes)
```

## BONQStaking

### NAME

```solidity
string NAME
```

### MINUTE_DECAY_FACTOR

```solidity
uint256 MINUTE_DECAY_FACTOR
```

### stakes

```solidity
mapping(address &#x3D;&gt; uint256) stakes
```

### totalBONQStaked

```solidity
uint256 totalBONQStaked
```

### F_StableCoin

```solidity
uint256 F_StableCoin
```

### F_StableCoinDelayed

```solidity
uint256 F_StableCoinDelayed
```

### lastFeeOperationTime

```solidity
uint256 lastFeeOperationTime
```

### F_StableCoinSnapshots

```solidity
mapping(address &#x3D;&gt; uint256) F_StableCoinSnapshots
```

### StableCoinUserGains

```solidity
mapping(address &#x3D;&gt; uint256) StableCoinUserGains
```

### factory

```solidity
contract ITroveFactory factory
```

### bonqToken

```solidity
contract IERC20 bonqToken
```

### stableCoin

```solidity
contract IERC20 stableCoin
```

### FactoryAddressSet

```solidity
event FactoryAddressSet(address _factoryAddress)
```

### BonqTokenAddressSet

```solidity
event BonqTokenAddressSet(address _bonqTokenAddress)
```

### StableCoinAddressSet

```solidity
event StableCoinAddressSet(address _stableCoinAddress)
```

### StakeChanged

```solidity
event StakeChanged(address staker, uint256 newStake)
```

### F_StableCoinUpdated

```solidity
event F_StableCoinUpdated(uint256 _F_StableCoin)
```

### F_StableCoinDelayedUpdated

```solidity
event F_StableCoinDelayedUpdated(uint256 _F_StableCoin)
```

### TotalBONQStakedUpdated

```solidity
event TotalBONQStakedUpdated(uint256 _totalBONQStaked)
```

### RewardRedeemed

```solidity
event RewardRedeemed(address _account, uint256 _stableAmount, address _troveAddress)
```

### StakerSnapshotsUpdated

```solidity
event StakerSnapshotsUpdated(address _staker, uint256 _F_StableCoin, uint256 _stableGains)
```

### constructor

```solidity
constructor(address _bonqToken) public
```

### setInitialLastFee

```solidity
function setInitialLastFee(uint256 _timestamp) public
```

_set timestamp to calculate next decayed rate from_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _timestamp | uint256 | uint256 in seconds |

### calcDecayedBaseRate

```solidity
function calcDecayedBaseRate(uint256 _currentBaseRate) external view returns (uint256)
```

_calculates the rate dacayed by time passed since last fee, uses &#x60;decPow&#x60; from BONQMath_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _currentBaseRate | uint256 | current rate to decay |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 decayed baseRate in uint256 |

### borrowingFee

```solidity
function borrowingFee(uint256 _amount) public pure returns (uint256)
```

_calculates borrowing fee from borrow amount_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | borrow amount |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 resulting fee |

### redemptionFee

```solidity
function redemptionFee(uint256 _amount) public pure returns (uint256)
```

_calculates redemption fee from borrow amount_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | redemption amount |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 resulting fee |

### setBONQToken

```solidity
function setBONQToken(address _bonqTokenAddress) external
```

_sets the BONQ token contract, if new address was updated_

### setFactory

```solidity
function setFactory(address _factoryAddress) external
```

_sets the TroveFactory contract, if address was updated_

### updateStableCoin

```solidity
function updateStableCoin() external
```

_sets the StableCoin token contract, if address was updated_

### stake

```solidity
function stake(uint256 _BONQamount) external
```

If caller has a pre-existing stake, records any accumulated StableCoin gains to them.

_to stake BONQ_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _BONQamount | uint256 | amount of BONQ to stake |

### unstake

```solidity
function unstake(uint256 _BONQamount) external
```

/ @dev to unstake BONQ
Unstake the BONQ and send the it back to the caller, and record accumulated StableCoin gains.
If requested amount &gt; stake, send their entire stake.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _BONQamount | uint256 | amount of BONQ to unstake |

### takeFees

```solidity
function takeFees(uint256 _amount) external returns (bool)
```

/ @dev to pay fee in StableCoin, transfer the amount specified
Unstake the BONQ and send the it back to the caller, and record accumulated StableCoin gains.
If requested amount &gt; stake, send their entire stake.

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | amount of StableCoin to pay as fee |

### redeemReward

```solidity
function redeemReward(uint256 _amount, address _troveAddress, address _newNextTrove) external
```

/ @dev to redeem StableCoin rewards, transfers the amount only to repay debt of the Trove
user can redeem StableCoin rewards only to repay the debt of the troves

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | amount of StableCoin to repay the debt |
| _troveAddress | address | address of the valid trove to repay the debt |
| _newNextTrove | address | hint for the newNextTrove position (next trove) |

### totalStake

```solidity
function totalStake() external view returns (uint256)
```

### getRewardAmount

```solidity
function getRewardAmount(address _user) external view returns (uint256)
```

### getRewardsTotal

```solidity
function getRewardsTotal() external view returns (uint256)
```

### _getPendingStableCoinGain

```solidity
function _getPendingStableCoinGain(address _user) internal view returns (uint256)
```

### _recordStableCoinGain

```solidity
function _recordStableCoinGain(address _user) internal
```

### _updateUserSnapshot

```solidity
function _updateUserSnapshot(address _user) internal
```

### _requireUserHasStake

```solidity
function _requireUserHasStake(uint256 currentStake) internal pure
```

### _requireNonZeroAmount

```solidity
function _requireNonZeroAmount(uint256 _amount) internal pure
```

## FixSupplyToken

_An implementation of the ERC20 contract which has a fixed TotalSupply at creation time_

### constructor

```solidity
constructor(string name, string symbol, uint256 totalSupply) public
```

## MintableToken

### minters

```solidity
mapping(address &#x3D;&gt; address) minters
```

_the list of minters_

### constructor

```solidity
constructor(string name, string symbol) public
```

### mint

```solidity
function mint(address recipient, uint256 amount) public
```

_mints tokens to the recipient, to be called from owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | address to mint |
| amount | uint256 | amount to be minted |

### burn

```solidity
function burn(uint256 amount) public
```

_burns token of specified amount from msg.sender_

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | to burn |

## IBONQStaking

### totalStake

```solidity
function totalStake() external view returns (uint256)
```

### getRewardsTotal

```solidity
function getRewardsTotal() external view returns (uint256)
```

### getRewardAmount

```solidity
function getRewardAmount(address _user) external view returns (uint256)
```

### stake

```solidity
function stake(uint256 _amount) external
```

### unstake

```solidity
function unstake(uint256 _amount) external
```

### redeemReward

```solidity
function redeemReward(uint256 _amount, address _troveAddress, address _newNextTrove) external
```

## IFeeRecipient

### borrowingFee

```solidity
function borrowingFee(uint256 _amount) external view returns (uint256)
```

### redemptionFee

```solidity
function redemptionFee(uint256 _amount) external view returns (uint256)
```

### calcDecayedBaseRate

```solidity
function calcDecayedBaseRate(uint256 _currentBaseRate) external view returns (uint256)
```

### takeFees

```solidity
function takeFees(uint256 _amount) external returns (bool)
```

_is called to make the FeeRecipient contract transfer the fees to itself. It will use transferFrom to get the
     fees from the msg.sender
     @param _amount the amount in Wei of fees to transfer_

## ILiquidationPool

### collateral

```solidity
function collateral() external view returns (uint256)
```

### debt

```solidity
function debt() external view returns (uint256)
```

### collateralPerStakedToken

```solidity
function collateralPerStakedToken() external view returns (uint256)
```

### approveTrove

```solidity
function approveTrove(address _trove) external
```

### unapproveTrove

```solidity
function unapproveTrove(address _trove) external
```

### liquidate

```solidity
function liquidate() external
```

## IMintableToken

### mint

```solidity
function mint(address recipient, uint256 amount) external
```

### burn

```solidity
function burn(uint256 amount) external
```

## IMintableTokenOwner

### token

```solidity
function token() external view returns (contract IMintableToken)
```

### mint

```solidity
function mint(address _recipient, uint256 _amount) external
```

### transferTokenOwnership

```solidity
function transferTokenOwnership(address _newOwner) external
```

### addMinter

```solidity
function addMinter(address _newMinter) external
```

### revokeMinter

```solidity
function revokeMinter(address _minter) external
```

## IOwnable

### owner

```solidity
function owner() external view returns (address)
```

_Returns the address of the current owner._

### transferOwnership

```solidity
function transferOwnership(address newOwner) external
```

_Transfers ownership of the contract to a new account (&#x60;newOwner&#x60;).
Can only be called by the current owner._

## IPriceFeed

### token

```solidity
function token() external view returns (address)
```

### price

```solidity
function price() external view returns (uint256)
```

### update

```solidity
function update() external
```

## IRouter

### WETH

```solidity
function WETH() external view returns (address)
```

### addLiquidity

```solidity
function addLiquidity(address token0, address token1, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amount0, uint256 amount1, uint256 liquidity)
```

### addLiquidityETH

```solidity
function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)
```

### removeLiquidity

```solidity
function removeLiquidity(address token0, address token1, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB)
```

### removeLiquidityETH

```solidity
function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) external returns (uint256 amountToken, uint256 amountETH)
```

### removeLiquidityWithPermit

```solidity
function removeLiquidityWithPermit(address token0, address token1, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) external returns (uint256 amountA, uint256 amountB)
```

### removeLiquidityETHWithPermit

```solidity
function removeLiquidityETHWithPermit(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) external returns (uint256 amountToken, uint256 amountETH)
```

### swapExactTokensForTokens

```solidity
function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) external
```

### swapTokensForExactTokens

```solidity
function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) external
```

### swapExactETHForTokens

```solidity
function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) external payable
```

### swapTokensForExactETH

```solidity
function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) external
```

### swapExactTokensForETH

```solidity
function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) external
```

### swapETHForExactTokens

```solidity
function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline) external payable
```

### quote

```solidity
function quote(address poolAddr, address token, uint256 amountIn) external view returns (uint256)
```

### getAmountOut

```solidity
function getAmountOut(uint256 amountIn, address token0, address token1) external view returns (uint256 amountOut)
```

### getAmountIn

```solidity
function getAmountIn(uint256 amountOut, address token0, address token1) external view returns (uint256 amountIn)
```

### getAmountsOut

```solidity
function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] amounts)
```

### getAmountsIn

```solidity
function getAmountsIn(uint256 amountOut, address[] path) external view returns (uint256[] amounts)
```

## IStabilityPool

### totalDeposit

```solidity
function totalDeposit() external view returns (uint256)
```

### withdraw

```solidity
function withdraw(uint256 _amount) external
```

### deposit

```solidity
function deposit(uint256 _amount) external
```

### redeemReward

```solidity
function redeemReward() external
```

### liquidate

```solidity
function liquidate() external
```

### setBONQPerMinute

```solidity
function setBONQPerMinute(uint256 _bonqPerMinute) external
```

### setBONQAmountForRewards

```solidity
function setBONQAmountForRewards(uint256 _bonqPerMinute) external
```

## ITokenPriceFeed

### tokenPriceFeeds

```solidity
function tokenPriceFeeds(address) external view returns (address)
```

### tokenPrice

```solidity
function tokenPrice(address _token) external view returns (uint256)
```

### MCR

```solidity
function MCR(address _token) external view returns (uint256)
```

### setTokenPriceFeed

```solidity
function setTokenPriceFeed(address _token, address _priceFeed) external
```

## ITrove

### factory

```solidity
function factory() external view returns (address)
```

### token

```solidity
function token() external view returns (address)
```

### collateralization

```solidity
function collateralization() external view returns (uint256)
```

### collateralValue

```solidity
function collateralValue() external view returns (uint256)
```

### collateral

```solidity
function collateral() external view returns (uint256)
```

### debt

```solidity
function debt() external view returns (uint256)
```

### netDebt

```solidity
function netDebt() external view returns (uint256)
```

### rewardRatioSnapshot

```solidity
function rewardRatioSnapshot() external view returns (uint256)
```

### increaseCollateral

```solidity
function increaseCollateral(uint256 _amount, address _newNextTrove) external
```

### decreaseCollateral

```solidity
function decreaseCollateral(address _recipient, uint256 _amount, address _newNextTrove) external
```

### repay

```solidity
function repay(uint256 _amount, address _newNextTrove) external
```

### redeem

```solidity
function redeem(address _recipient, address _newNextTrove) external returns (uint256 _stableAmount, uint256 _collateralRecieved)
```

## ITroveCreator

### createTrove

```solidity
function createTrove(address _factory, address _token, address _troveOwner) external returns (contract ITrove)
```

## ITroveFactory

### lastTrove

```solidity
function lastTrove(address _trove) external view returns (address)
```

### firstTrove

```solidity
function firstTrove(address _trove) external view returns (address)
```

### nextTrove

```solidity
function nextTrove(address _token, address _trove) external view returns (address)
```

### prevTrove

```solidity
function prevTrove(address _token, address _trove) external view returns (address)
```

### containsTrove

```solidity
function containsTrove(address _token, address _trove) external view returns (bool)
```

### stableCoin

```solidity
function stableCoin() external view returns (contract IMintableToken)
```

### tokenOwner

```solidity
function tokenOwner() external view returns (contract IMintableTokenOwner)
```

### tokenToPriceFeed

```solidity
function tokenToPriceFeed() external view returns (contract ITokenPriceFeed)
```

### feeRecipient

```solidity
function feeRecipient() external view returns (contract IFeeRecipient)
```

### troveCount

```solidity
function troveCount(address _token) external view returns (uint256)
```

### totalDebt

```solidity
function totalDebt() external view returns (uint256)
```

### totalCollateral

```solidity
function totalCollateral(address _token) external view returns (uint256)
```

### totalDebtForToken

```solidity
function totalDebtForToken(address _token) external view returns (uint256)
```

### liquidationPool

```solidity
function liquidationPool(address _token) external view returns (contract ILiquidationPool)
```

### stabilityPool

```solidity
function stabilityPool() external view returns (contract IStabilityPool)
```

### createTrove

```solidity
function createTrove(address _token) external
```

### removeTrove

```solidity
function removeTrove(address _token, address _trove) external
```

### insertTrove

```solidity
function insertTrove(address _trove, address _newNextTrove) external
```

### updateTotalCollateral

```solidity
function updateTotalCollateral(address _token, uint256 _amount, bool _increase) external
```

### updateTotalDebt

```solidity
function updateTotalDebt(uint256 _amount, bool _borrow) external
```

### setStabilityPool

```solidity
function setStabilityPool(address _stabilityPool) external
```

### setWETH

```solidity
function setWETH(address _WETH, address _liquidationPool) external
```

### increaseCollateralNative

```solidity
function increaseCollateralNative(address _trove, address _newNextTrove) external payable
```

### updatePrice

```solidity
function updatePrice(address _token) external
```

### emitLiquidationEvent

```solidity
function emitLiquidationEvent(address _token, address _trove, bool stabilityPoolLiquidation) external
```

### emitTroveCollateralUpdate

```solidity
function emitTroveCollateralUpdate(address _token, address _trove, uint256 _newAmount) external
```

### emitTroveDebtUpdate

```solidity
function emitTroveDebtUpdate(address _token, address _trove, uint256 _newAmount) external
```

## IWETH

### deposit

```solidity
function deposit() external payable
```

### approve

```solidity
function approve(address, uint256) external returns (bool)
```

### transfer

```solidity
function transfer(address _to, uint256 _value) external returns (bool)
```

### withdraw

```solidity
function withdraw(uint256) external
```

## CommunityLiquidationPool

### factory

```solidity
contract ITroveFactory factory
```

### collateralPerStakedToken

```solidity
uint256 collateralPerStakedToken
```

### collateral

```solidity
uint256 collateral
```

### debt

```solidity
uint256 debt
```

### collateralToken

```solidity
contract IERC20 collateralToken
```

### constructor

```solidity
constructor(address _factory, address _token) public
```

### approveTrove

```solidity
function approveTrove(address _trove) public
```

_to approve trove, and let it liquidate itself further_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _trove | address | address of the trove |

### unapproveTrove

```solidity
function unapproveTrove(address _trove) public
```

_to unapprove trove, forbid it to liquidate itself further_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _trove | address | address of the trove |

### liquidate

```solidity
function liquidate() public
```

_liquidates the trove that called it_

## MintableTokenOwner

### token

```solidity
contract IMintableToken token
```

### minters

```solidity
mapping(address &#x3D;&gt; bool) minters
```

### constructor

```solidity
constructor(address _token) public
```

### mint

```solidity
function mint(address _recipient, uint256 _amount) public
```

_mints tokens to the recipient, to be called from owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _recipient | address | address to mint |
| _amount | uint256 | amount to be minted |

### transferTokenOwnership

```solidity
function transferTokenOwnership(address _newOwner) public
```

### addMinter

```solidity
function addMinter(address _newMinter) public
```

_adds new minter_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newMinter | address | address of new minter |

### revokeMinter

```solidity
function revokeMinter(address _minter) public
```

_removes minter from minter list_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _minter | address | address of the minter |

## PriceFeed

### UPDATE_PERIOD

```solidity
uint256 UPDATE_PERIOD
```

### DECIMAL_PRECISION

```solidity
uint256 DECIMAL_PRECISION
```

### PRICE_AVERAGE_PERIOD

```solidity
uint256 PRICE_AVERAGE_PERIOD
```

### collateralToken

```solidity
address collateralToken
```

### stableCoin

```solidity
address stableCoin
```

### router

```solidity
contract IRouter router
```

### CumulativePriceSnampshot

```solidity
struct CumulativePriceSnampshot {
  uint256 blockTimestamp;
  uint256 price0Cumulative;
  uint256 price1Cumulative;
}
```

### snapshots

```solidity
struct PriceFeed.CumulativePriceSnampshot[15] snapshots
```

### shift

```solidity
uint256 shift
```

### price0CumulativeLast

```solidity
uint256 price0CumulativeLast
```

### price1CumulativeLast

```solidity
uint256 price1CumulativeLast
```

### blockTimestampLast

```solidity
uint256 blockTimestampLast
```

### price0Average

```solidity
uint256 price0Average
```

### price1Average

```solidity
uint256 price1Average
```

### updateCounter

```solidity
uint256 updateCounter
```

### constructor

```solidity
constructor(address _collateralToken, address _stableCoin, address _routerAddress, address _ownerAddress) public
```

### update

```solidity
function update() external
```

### price

```solidity
function price() external view returns (uint256)
```

this will always return 0 before update has been called successfully for the first time.

### consult

```solidity
function consult(address _token, uint256 amountIn) external view returns (uint256 amountOut)
```

### token

```solidity
function token() external view returns (address)
```

## StabilityPool

### TokenToS

```solidity
struct TokenToS {
  address tokenAddress;
  uint256 S_value;
}
```

### TokenToUint256

```solidity
struct TokenToUint256 {
  address tokenAddress;
  uint256 value;
}
```

### Snapshots

```solidity
struct Snapshots {
  struct StabilityPool.TokenToS[] tokenToSArray;
  uint256 P;
  uint256 G;
  uint128 scale;
  uint128 epoch;
}
```

### factory

```solidity
contract ITroveFactory factory
```

### totalDeposit

```solidity
uint256 totalDeposit
```

### collateralToLastError_Offset

```solidity
mapping(address &#x3D;&gt; uint256) collateralToLastError_Offset
```

### lastStableCoinLossError_Offset

```solidity
uint256 lastStableCoinLossError_Offset
```

### deposits

```solidity
mapping(address &#x3D;&gt; uint256) deposits
```

### depositSnapshots

```solidity
mapping(address &#x3D;&gt; struct StabilityPool.Snapshots) depositSnapshots
```

### stableCoin

```solidity
contract IMintableToken stableCoin
```

### bonqToken

```solidity
contract IERC20 bonqToken
```

### bonqPerMinute

```solidity
uint256 bonqPerMinute
```

### totalBONQRewardsLeft

```solidity
uint256 totalBONQRewardsLeft
```

### latestBONQRewardTime

```solidity
uint256 latestBONQRewardTime
```

### lastBONQError

```solidity
uint256 lastBONQError
```

### P

```solidity
uint256 P
```

### SCALE_FACTOR

```solidity
uint256 SCALE_FACTOR
```

### SECONDS_IN_ONE_MINUTE

```solidity
uint256 SECONDS_IN_ONE_MINUTE
```

### currentScale

```solidity
uint128 currentScale
```

### currentEpoch

```solidity
uint128 currentEpoch
```

### epochToScaleToTokenToSum

```solidity
mapping(uint128 &#x3D;&gt; mapping(uint128 &#x3D;&gt; struct StabilityPool.TokenToS[])) epochToScaleToTokenToSum
```

### epochToScaleToG

```solidity
mapping(uint128 &#x3D;&gt; mapping(uint128 &#x3D;&gt; uint256)) epochToScaleToG
```

### Deposit

```solidity
event Deposit(address _contributor, uint256 _amount)
```

### TotalDepositUpdated

```solidity
event TotalDepositUpdated(uint256 _newValue)
```

### Withdraw

```solidity
event Withdraw(address _contributor, uint256 _amount)
```

### BONQRewardRedeemed

```solidity
event BONQRewardRedeemed(address _contributor, uint256 _amount)
```

### CollateralRewardRedeemed

```solidity
event CollateralRewardRedeemed(address _contributor, address _tokenAddress, uint256 _amount)
```

### BONQRewardIssue

```solidity
event BONQRewardIssue(uint256 issuance, uint256 _totalBONQRewardsLeft)
```

### DepositSnapshotUpdated

```solidity
event DepositSnapshotUpdated(address _depositor, uint256 _P, struct StabilityPool.TokenToS[] _tokenToS, uint256 _G)
```

### P_Updated

```solidity
event P_Updated(uint256 _P)
```

### S_Updated

```solidity
event S_Updated(address _tokenAddress, uint256 _S, uint128 _epoch, uint128 _scale)
```

### G_Updated

```solidity
event G_Updated(uint256 _G, uint128 _epoch, uint128 _scale)
```

### EpochUpdated

```solidity
event EpochUpdated(uint128 _currentEpoch)
```

### ScaleUpdated

```solidity
event ScaleUpdated(uint128 _currentScale)
```

### constructor

```solidity
constructor(address _factory, address _bonqToken) public
```

### deposit

```solidity
function deposit(uint256 _amount) public
```

_to deposit StableCoin into StabilitPool_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | amount to deposit |

### withdraw

```solidity
function withdraw(uint256 _amount) public
```

_to withdraw StableCoin that was not spent_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | amount to withdraw |

### redeemReward

```solidity
function redeemReward() public
```

_to withdraw collateral rewards earned after liquidations_

### liquidate

```solidity
function liquidate() public
```

msut be called by the valid trove

_liquidates trove, must be called from that trove_

### setBONQToken

```solidity
function setBONQToken(address _bonqTokenAddress) external
```

_sets the BONQ token contract_

### setBONQPerMinute

```solidity
function setBONQPerMinute(uint256 _bonqPerMinute) external
```

_sets amount of BONQ per minute for rewards_

### setBONQAmountForRewards

```solidity
function setBONQAmountForRewards(uint256 _amountForRewards) external
```

_sets total amount of BONQ to be rewarded (pays per minute until reaches the amount rewarded)_

### _redeemReward

```solidity
function _redeemReward() private
```

_redeems all rewards of the user (Collateral and BONQ)_

### _redeemCollateralReward

```solidity
function _redeemCollateralReward() internal
```

### _redeemBONQReward

```solidity
function _redeemBONQReward() internal
```

### _updateDepositAndSnapshots

```solidity
function _updateDepositAndSnapshots(address _depositor, uint256 _newValue) private
```

_updates user deposit snapshot data for new deposit value_

### _updateRewardSumAndProduct

```solidity
function _updateRewardSumAndProduct(address _collateralTokenAddress, uint256 _CollateralGainPerUnitStaked, uint256 _StableCoinLossPerUnitStaked) internal
```

_updates S and P value for user snapshot rewards, and epoch_

### _updateG

```solidity
function _updateG(uint256 _BONQIssuance) internal
```

_updates G when new BONQ amount is issued_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _BONQIssuance | uint256 | new BONQ issuance amount |

### _getDepositorCollateralGains

```solidity
function _getDepositorCollateralGains(address _depositor) internal view returns (struct StabilityPool.TokenToUint256[])
```

### _getCollateralGainsArrayFromSnapshots

```solidity
function _getCollateralGainsArrayFromSnapshots(uint256 _initialDeposit, struct StabilityPool.Snapshots _snapshots) internal view returns (struct StabilityPool.TokenToUint256[])
```

### _getCollateralGainFromSnapshots

```solidity
function _getCollateralGainFromSnapshots(uint256 initialDeposit, uint256 S, uint256 nextScaleS, uint256 S_Snapshot, uint256 P_Snapshot) internal pure returns (uint256)
```

### _getDepositorBONQGain

```solidity
function _getDepositorBONQGain(address _depositor) internal view returns (uint256)
```

### _getBONQGainFromSnapshots

```solidity
function _getBONQGainFromSnapshots(uint256 _initialDeposit, struct StabilityPool.Snapshots _snapshots) internal view returns (uint256)
```

### _getCompoundedDepositFromSnapshots

```solidity
function _getCompoundedDepositFromSnapshots(uint256 _initialStake, struct StabilityPool.Snapshots _snapshots) internal view returns (uint256)
```

_gets compounded deposit of the user_

### _computeRewardsPerUnitStaked

```solidity
function _computeRewardsPerUnitStaked(address _collateralTokenAddress, uint256 _collToAdd, uint256 _debtToOffset, uint256 _totalStableCoinDeposits) internal returns (uint256 CollateralGainPerUnitStaked, uint256 StableCoinLossPerUnitStaked)
```

_Compute the StableCoin and Collateral rewards. Uses a &quot;feedback&quot; error correction, to keep
the cumulative error in the P and S state variables low:s_

### _triggerBONQdistribution

```solidity
function _triggerBONQdistribution() internal
```

_distributes BONQ per minutes that was not spent yet_

### _issueBONQRewards

```solidity
function _issueBONQRewards() internal returns (uint256)
```

### _computeBONQPerUnitStaked

```solidity
function _computeBONQPerUnitStaked(uint256 _BONQIssuance, uint256 _totalStableCoinDeposits) internal returns (uint256)
```

### _sendCollateralRewardsToDepositor

```solidity
function _sendCollateralRewardsToDepositor(struct StabilityPool.TokenToUint256[] _depositorCollateralGains) internal
```

_transfers collateral rewards tokens precalculated to the depositor_

### _sendBONQRewardsToDepositor

```solidity
function _sendBONQRewardsToDepositor(uint256 _BONQGain) internal
```

_transfers BONQ amount to the user_

## TestAddressList

### _addressList

```solidity
struct LinkedAddressList.List _addressList
```

### addressListElement

```solidity
function addressListElement(address _element) public view returns (struct LinkedAddressList.EntryLink)
```

### lastAddressListElement

```solidity
function lastAddressListElement() public view returns (address)
```

### firstAddressListElement

```solidity
function firstAddressListElement() public view returns (address)
```

### addressListSize

```solidity
function addressListSize() public view returns (uint256)
```

### appendAddress

```solidity
function appendAddress(address newAddress) public
```

### addAddress

```solidity
function addAddress(address newAddress, address _reference, bool before) public
```

### removeAddress

```solidity
function removeAddress(address _existingElement) public
```

## TestFeeRecipient

### feeToken

```solidity
contract IERC20 feeToken
```

### constructor

```solidity
constructor(address _feeToken) public
```

### calcDecayedBaseRate

```solidity
function calcDecayedBaseRate(uint256 _amount) public pure returns (uint256)
```

### borrowingFee

```solidity
function borrowingFee(uint256 _amount) public pure returns (uint256)
```

### redemptionFee

```solidity
function redemptionFee(uint256 _amount) public pure returns (uint256)
```

### takeFees

```solidity
function takeFees(uint256 _amount) public returns (bool)
```

_is called to make the FeeRecipient contract transfer the fees to itself. It will use transferFrom to get the
     fees from the msg.sender
     @param _amount the amount in Wei of fees to transfer_

## TestPriceFeed

### token

```solidity
address token
```

### price

```solidity
uint256 price
```

### constructor

```solidity
constructor(address _token) public
```

### setPrice

```solidity
function setPrice(uint256 _price) public
```

### update

```solidity
function update() public
```

### owner

```solidity
function owner() public view returns (address)
```

## TokenToPriceFeed

### tokenPriceFeeds

```solidity
mapping(address &#x3D;&gt; address) tokenPriceFeeds
```

### MCR

```solidity
mapping(address &#x3D;&gt; uint256) MCR
```

### tokenPrice

```solidity
function tokenPrice(address _token) public view returns (uint256)
```

_to get token price_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | address of the token |

### setTokenPriceFeed

```solidity
function setTokenPriceFeed(address _token, address _priceFeed, uint256 _mcr) public
```

_to set or change priceFeed contract for token_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | address of the token |
| _priceFeed | address | address of the PriceFeed contract for token |
| _mcr | uint256 | minimal collateral ratio of the token |

## TroveCreator

### createTrove

```solidity
function createTrove(address _factory, address _token, address _troveOwner) external returns (contract ITrove)
```

_to create new Trove for user_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address | address of the TroveFactory |
| _token | address | address of the token |
| _troveOwner | address | address of the user to own new Trove |

## TroveFactory

### TroveList

```solidity
struct TroveList {
  uint256 totalCollateral;
  uint256 totalDebt;
  contract ILiquidationPool liquidationPool;
  struct LinkedAddressList.List list;
}
```

### troveCreator

```solidity
contract ITroveCreator troveCreator
```

### stabilityPool

```solidity
contract IStabilityPool stabilityPool
```

### _troves

```solidity
mapping(address &#x3D;&gt; struct TroveFactory.TroveList) _troves
```

### tokenOwner

```solidity
contract IMintableTokenOwner tokenOwner
```

### tokenToPriceFeed

```solidity
contract ITokenPriceFeed tokenToPriceFeed
```

### stableCoin

```solidity
contract IMintableToken stableCoin
```

### WETHContract

```solidity
contract IWETH WETHContract
```

### feeRecipient

```solidity
contract IFeeRecipient feeRecipient
```

### totalDebt

```solidity
uint256 totalDebt
```

### REDEMPTION_RATE

```solidity
uint256 REDEMPTION_RATE
```

### BORROWING_RATE

```solidity
uint256 BORROWING_RATE
```

### MAX_BORROWING_RATE

```solidity
uint256 MAX_BORROWING_RATE
```

### baseRate

```solidity
uint256 baseRate
```

### NewTrove

```solidity
event NewTrove(address trove, address token, address owner)
```

### TroveRemoved

```solidity
event TroveRemoved(address trove)
```

### TroveLiquidated

```solidity
event TroveLiquidated(address trove, bool stabilityPoolLiquidation)
```

### TroveInserted

```solidity
event TroveInserted(address token, address trove, address referenceTrove, bool before)
```

### CollateralUpdate

```solidity
event CollateralUpdate(address token, uint256 totalCollateral)
```

### DebtUpdate

```solidity
event DebtUpdate(address collateral, uint256 totalDebt)
```

### PriceUpdate

```solidity
event PriceUpdate(address token, uint256 price)
```

### Redemption

```solidity
event Redemption(address token, uint256 stableAmount, uint256 tokenAmount, uint256 stableUnspent)
```

### TroveCollateralUpdate

```solidity
event TroveCollateralUpdate(address trove, uint256 newAmount)
```

### TroveDebtUpdate

```solidity
event TroveDebtUpdate(address trove, uint256 newAmount)
```

### troveExists

```solidity
modifier troveExists(address _token, address _trove)
```

### constructor

```solidity
constructor(address _troveCreator, address _stableCoin, address _feeRecipient) public
```

### troveCount

```solidity
function troveCount(address _token) public view returns (uint256)
```

_returns the number of troves for specific token_

### lastTrove

```solidity
function lastTrove(address _token) public view returns (address)
```

_returns the last trove by maximum collaterization ratio_

### firstTrove

```solidity
function firstTrove(address _token) public view returns (address)
```

_returns the first trove by minimal collaterization ratio_

### nextTrove

```solidity
function nextTrove(address _token, address _trove) public view returns (address)
```

_returns the next trove by collaterization ratio_

### prevTrove

```solidity
function prevTrove(address _token, address _trove) public view returns (address)
```

_returns the previous trove by collaterization ratio_

### containsTrove

```solidity
function containsTrove(address _token, address _trove) public view returns (bool)
```

_returns and checks if such trove exists for this token_

### totalCollateral

```solidity
function totalCollateral(address _token) public view returns (uint256)
```

_returns total collateral among all troves for specific token_

### totalDebtForToken

```solidity
function totalDebtForToken(address _token) public view returns (uint256)
```

_returns total debt among all troves for specific token_

### tokenCollateralization

```solidity
function tokenCollateralization(address _token) public view returns (uint256)
```

_returns total collateral ratio averaged between troves for specific token_

### liquidationPool

```solidity
function liquidationPool(address _token) public view returns (contract ILiquidationPool)
```

_returns contract address of LiquidationPool for specific token_

### getRedemptionFee

```solidity
function getRedemptionFee(uint256 _amount) public view returns (uint256)
```

_returns fee from redeeming the amount_

### getRedemptionAmount

```solidity
function getRedemptionAmount(uint256 _amount) public view returns (uint256)
```

_returns amount to be used in redemption excluding fee,_

### getBorrowingFee

```solidity
function getBorrowingFee(uint256 _amount) public view returns (uint256)
```

_returns fee from borrowing the amount_

### setTokenOwner

```solidity
function setTokenOwner() public
```

_sets address of the contract for stableCoin issuance_

### setFeeRecipient

```solidity
function setFeeRecipient(address _feeRecipient) public
```

_sets contract address of FeeRecipient_

### setTokenPriceFeed

```solidity
function setTokenPriceFeed(address _tokenPriceFeed) public
```

_sets contract address of TokenPriceFeed_

### setLiquidationPool

```solidity
function setLiquidationPool(address _token, address _liquidationPool) public
```

_sets contract address of LiquidationPool for specific token_

### setStabilityPool

```solidity
function setStabilityPool(address _stabilityPool) external
```

_sets contract address of StabilityPool_

### setWETH

```solidity
function setWETH(address _WETH, address _liquidationPool) external
```

_sets contract address of Wrapped native token, along with liquidationPool_

### transferTokenOwnerOwnership

```solidity
function transferTokenOwnerOwnership(address _newOwner) public
```

_transfers contract ownership
this function is used when a new TroveFactory version is deployed and the same tokens are used. We transfer the
ownership of the TokenOwner contract and the new TroveFactory is able to add minters_

### updateTotalCollateral

```solidity
function updateTotalCollateral(address _token, uint256 _amount, bool _increase) public
```

_function to be called from trove to update total collateral value of all troves of this tokens_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address |  |
| _amount | uint256 |  |
| _increase | bool | bool that indicates &quot;+&quot; or &quot;-&quot; operation |

### increaseCollateralNative

```solidity
function increaseCollateralNative(address _trove, address _newNextTrove) public payable
```

_deposits native token into trove after wrapping the ETH (EWT, AVAX, etc) into WETH (WEWT, WAVAX, etc)_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _trove | address | tove to be deposited in |
| _newNextTrove | address | hint for next trove position |

### updatePrice

```solidity
function updatePrice(address _token) public
```

_updates price of token from priceFeed_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | any supported token address |

### createTrove

```solidity
function createTrove(address _token) public
```

_creates a trove if the token is supported_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | any supported token address |

### removeTrove

```solidity
function removeTrove(address _token, address _trove) public
```

_remove a trove from the list and send any remaining token balance to the owner_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address |  |
| _trove | address | is the trove which will be removed |

### insertTrove

```solidity
function insertTrove(address _token, address _newNextTrove) public
```

_insert a trove in the sorted list of troves. the troves must be sorted by collateralisation ratio CR
the sender must be the trove which will be inserted in the list_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address |  |
| _newNextTrove | address | is the trove before which the trove will be added |

### _redeemFullTrove

```solidity
function _redeemFullTrove(address _recipient, address _trove) internal returns (uint256 _stableAmount, uint256 _collateralRecieved)
```

_redeem all collateral the trove can provide_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _recipient | address | is the trove _recipient to redeem colateral to and take stableCoin from |
| _trove | address |  |

### _redeemPartTrove

```solidity
function _redeemPartTrove(address _recipient, address _trove, uint256 _stableAmount, address _newNextTrove) internal returns (uint256 stableAmount, uint256 collateralRecieved)
```

_redeem collateral from the tove to fit desired stableCoin amount
    @param _recipient is the trove _recipient to redeem colateral to and take stableCoin from
    @param _stableAmount the desired amount of StableCoin to pay for redemption
    @param _newNextTrove hint for the of the nextNewTrove after redemption_

### redeemStableCoinForCollateral

```solidity
function redeemStableCoinForCollateral(address _collateralToken, uint256 _stableAmount, uint256 _maxRate, uint256 _lastTroveCurrentICR, address _lastTroveNewPositionHint) public
```

_redeem desired StableCoin amount for desired collateral tokens_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _collateralToken | address |  |
| _stableAmount | uint256 | the desired amount of StableCoin to pay for redemption |
| _maxRate | uint256 | is max fee (in % with 1e18 precision) allowed to pay |
| _lastTroveCurrentICR | uint256 | ICR of the last trove to be redeemed, if matches then the hint is working and it redeems |
| _lastTroveNewPositionHint | address | hint for the of the nextNewTrove after redemption for the latest trove |

### updateTotalDebt

```solidity
function updateTotalDebt(uint256 _amount, bool _borrow) public
```

_function to be called from trove to change totalDebt_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |
| _borrow | bool | indicates if it is borrow or repay/liquidatin |

### emitLiquidationEvent

```solidity
function emitLiquidationEvent(address _token, address _trove, bool stabilityPoolLiquidation) public
```

_to emit Liquidation event, to be called from trove_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | address of token |
| _trove | address | address of the Trove |
| stabilityPoolLiquidation | bool |  |

### emitTroveDebtUpdate

```solidity
function emitTroveDebtUpdate(address _token, address _trove, uint256 _newAmount) public
```

_to emit Trove&#x27;s debt update event, to be called from trove_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | address of token |
| _trove | address | address of the Trove |
| _newAmount | uint256 | new trove&#x27;s debt value |

### emitTroveCollateralUpdate

```solidity
function emitTroveCollateralUpdate(address _token, address _trove, uint256 _newAmount) public
```

_to emit Collateral update event, to be called from trove_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | address of token |
| _trove | address | address of the Trove |
| _newAmount | uint256 | new trove&#x27;s Collateral value |

## Trove

### factory

```solidity
contract ITroveFactory factory
```

### token

```solidity
contract IERC20 token
```

### _debt

```solidity
uint256 _debt
```

### liquidationReserve

```solidity
uint256 liquidationReserve
```

### recordedCollateral

```solidity
uint256 recordedCollateral
```

### rewardRatioSnapshot

```solidity
uint256 rewardRatioSnapshot
```

### TOKEN_PRECISION

```solidity
uint256 TOKEN_PRECISION
```

### Liquidated

```solidity
event Liquidated(address trove, uint256 debt, uint256 collateral)
```

### onlyFactory

```solidity
modifier onlyFactory()
```

_restrict the call to be from the factory contract_

### constructor

```solidity
constructor(address _factory, address _token) public
```

### mcr

```solidity
function mcr() public view returns (uint256)
```

_the Minimum Collateralisation Ratio for this trove as set in the Token to Price Feed contract._

### unclaimedCollateralRewardAndDebt

```solidity
function unclaimedCollateralRewardAndDebt() public view returns (uint256, uint256)
```

_the reward in the liquidation pool which has not been claimed yet_

### collateral

```solidity
function collateral() public view returns (uint256)
```

_this function will return the actual collateral (balance of the collateral token) including any liquidation rewards from community liquidation_

### debt

```solidity
function debt() public view returns (uint256)
```

_this function will return the actual debt including any liquidation liabilities from community liquidation_

### netDebt

```solidity
function netDebt() public view returns (uint256)
```

_the net debt is the debt minus the liquidation reserve_

### collateralValue

```solidity
function collateralValue() public view returns (uint256)
```

_the value of the collateral * the current price as returned by the price feed contract for the collateral token_

### collateralization

```solidity
function collateralization() public view returns (uint256)
```

_the Individual Collateralisation Ratio (ICR) of the trove_

### insertTrove

```solidity
function insertTrove(address _newNextTrove) private
```

_insert the trove in the factory contract in the right spot of the list of troves with the same token_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newNextTrove | address | is the trove that we think will be the next one in the list. This might be off in case there were some other list changing transactions |

### borrow

```solidity
function borrow(address _recipient, uint256 _amount, address _newNextTrove) public
```

_mint some stable coins and pay the issuance fee. The transaction will fail if the resulting ICR &lt; MCR_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _recipient | address | is the address to which the newly minted tokens will be transferred |
| _amount | uint256 | the value of the minting |
| _newNextTrove | address | is the trove that we think will be the next one in the list. This might be off in case there were some other list changing transactions |

### repay

```solidity
function repay(uint256 _amount, address _newNextTrove) public
```

_repay a portion of the debt by either sending some stable coins to the trove or allowing the trove to take tokens out of your balance_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | the amount of stable coins to reduce the debt with |
| _newNextTrove | address | is the trove that we think will be the next one in the list. This might be off in case there were some other list changing transactions |

### getLiquidationRewards

```solidity
function getLiquidationRewards() internal
```

_if there have been liquidations since the last time this trove&#x27;s state was updated, it should fetch the available rewards and debt_

### updateCollateral

```solidity
function updateCollateral() private returns (uint256)
```

_update the state variables recordedCollateral and rewardRatioSnapshot and get all the collateral into the trove_

### increaseCollateral

```solidity
function increaseCollateral(uint256 _amount, address _newNextTrove) public
```

_there are two options to increase the collateral:
1. transfer the tokens to the trove and call increaseCollateral with amount &#x3D; 0
2. grant the trove permission to transfer from your account and call increaseCollateral with amount &gt; 0_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | a positive amount to transfer from the sender&#x27;s account or zero |
| _newNextTrove | address | once the trove is better collateralised, its position in the list will change, the caller should indicate the new position in order to reduce gas consumption |

### decreaseCollateral

```solidity
function decreaseCollateral(address _recipient, uint256 _amount, address _newNextTrove) public
```

_send some or all of the balance of the trove to an arbitrary address. Only the owner of the trove can do this
as long as the debt is Zero, the transfer is performed without further checks.
once the debt is not zero, the trove position in the trove list is changed to keep the list ordered by
collateralisation ratio_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _recipient | address | the address which will receive the tokens |
| _amount | uint256 | amount of collateral |
| _newNextTrove | address | hint for next trove after reorder |

### redeem

```solidity
function redeem(address _recipient, address _newNextTrove) public returns (uint256 _stableAmount, uint256 _collateralRecieved)
```

_is called to redeem StableCoin for token, called by factory when MCR &gt; ICR,
amount of StableCoin is taken from balance and must be &lt;&#x3D; netDebt.
uses priceFeed to calculate collateral amount.
returns amount of StableCoin used and collateral recieved_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _recipient | address | the address which recieves redeemed token |
| _newNextTrove | address | hint for next trove after reorder, if it&#x27;s not full redemption |

### liquidate

```solidity
function liquidate() public
```

_is called to liquidate the trove, if ICR &lt; MCR then all the collateral is sent to the liquidation pool and the debt is forgiven
the msg.sender is allowed to transfer the liquidation reserve out of the trove_

### transferToken

```solidity
function transferToken(address _token, address _recipient) public
```

_security function to make sure that if tokens are sent to the trove by mistake, they&#x27;re not lost.
It will always send the entire balance
This function can not be used to transfer the collateral token_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | the ERC20 to transfer |
| _recipient | address | the address the transfer should go to |

## BONQMath

### DECIMAL_PRECISION

```solidity
uint256 DECIMAL_PRECISION
```

### MAX_INT

```solidity
uint256 MAX_INT
```

### MINUTE_DECAY_FACTOR

```solidity
uint256 MINUTE_DECAY_FACTOR
```

### min

```solidity
function min(uint256 a, uint256 b) internal pure returns (uint256)
```

_return the smaller of two numbers_

### max

```solidity
function max(uint256 a, uint256 b) internal pure returns (uint256)
```

_return the bigger of two numbers_

### decMul

```solidity
function decMul(uint256 x, uint256 y) internal pure returns (uint256 decProd)
```

_Multiply two decimal numbers and use normal rounding rules:
 -round product up if 19&#x27;th mantissa digit &gt;&#x3D; 5
 -round product down if 19&#x27;th mantissa digit &lt; 5

Used only inside the exponentiation, _decPow()._

### _decPow

```solidity
function _decPow(uint256 _base, uint256 _minutes) internal pure returns (uint256)
```

_Exponentiation function for 18-digit decimal base, and integer exponent n.

Uses the efficient &quot;exponentiation by squaring&quot; algorithm. O(log(n)) complexity.

Called by function that represent time in units of minutes:
1) IFeeRecipient.calcDecayedBaseRate

The exponent is capped to avoid reverting due to overflow. The cap 525600000 equals
&quot;minutes in 1000 years&quot;: 60 * 24 * 365 * 1000

If a period of &gt; 1000 years is ever used as an exponent in either of the above functions, the result will be
negligibly different from just passing the cap, since:_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _base | uint256 | number to exponentially increase |
| _minutes | uint256 | power in minutes passed |

## Constants

### DECIMAL_PRECISION

```solidity
uint256 DECIMAL_PRECISION
```

### LIQUIDATION_RESERVE

```solidity
uint256 LIQUIDATION_RESERVE
```

### MAX_INT

```solidity
uint256 MAX_INT
```

## LinkedAddressList

### EntryLink

```solidity
struct EntryLink {
  address prev;
  address next;
}
```

### List

```solidity
struct List {
  address _last;
  address _first;
  uint256 _size;
  mapping(address &#x3D;&gt; struct LinkedAddressList.EntryLink) _values;
}
```

### add

```solidity
function add(struct LinkedAddressList.List _list, address _element, address _reference, bool _before) internal returns (bool)
```

### remove

```solidity
function remove(struct LinkedAddressList.List _list, address _element) internal returns (bool)
```

## console

### CONSOLE_ADDRESS

```solidity
address CONSOLE_ADDRESS
```

### _sendLogPayload

```solidity
function _sendLogPayload(bytes payload) private view
```

### log

```solidity
function log() internal view
```

### logInt

```solidity
function logInt(int256 p0) internal view
```

### logUint

```solidity
function logUint(uint256 p0) internal view
```

### logString

```solidity
function logString(string p0) internal view
```

### logBool

```solidity
function logBool(bool p0) internal view
```

### logAddress

```solidity
function logAddress(address p0) internal view
```

### logBytes

```solidity
function logBytes(bytes p0) internal view
```

### logBytes1

```solidity
function logBytes1(bytes1 p0) internal view
```

### logBytes2

```solidity
function logBytes2(bytes2 p0) internal view
```

### logBytes3

```solidity
function logBytes3(bytes3 p0) internal view
```

### logBytes4

```solidity
function logBytes4(bytes4 p0) internal view
```

### logBytes5

```solidity
function logBytes5(bytes5 p0) internal view
```

### logBytes6

```solidity
function logBytes6(bytes6 p0) internal view
```

### logBytes7

```solidity
function logBytes7(bytes7 p0) internal view
```

### logBytes8

```solidity
function logBytes8(bytes8 p0) internal view
```

### logBytes9

```solidity
function logBytes9(bytes9 p0) internal view
```

### logBytes10

```solidity
function logBytes10(bytes10 p0) internal view
```

### logBytes11

```solidity
function logBytes11(bytes11 p0) internal view
```

### logBytes12

```solidity
function logBytes12(bytes12 p0) internal view
```

### logBytes13

```solidity
function logBytes13(bytes13 p0) internal view
```

### logBytes14

```solidity
function logBytes14(bytes14 p0) internal view
```

### logBytes15

```solidity
function logBytes15(bytes15 p0) internal view
```

### logBytes16

```solidity
function logBytes16(bytes16 p0) internal view
```

### logBytes17

```solidity
function logBytes17(bytes17 p0) internal view
```

### logBytes18

```solidity
function logBytes18(bytes18 p0) internal view
```

### logBytes19

```solidity
function logBytes19(bytes19 p0) internal view
```

### logBytes20

```solidity
function logBytes20(bytes20 p0) internal view
```

### logBytes21

```solidity
function logBytes21(bytes21 p0) internal view
```

### logBytes22

```solidity
function logBytes22(bytes22 p0) internal view
```

### logBytes23

```solidity
function logBytes23(bytes23 p0) internal view
```

### logBytes24

```solidity
function logBytes24(bytes24 p0) internal view
```

### logBytes25

```solidity
function logBytes25(bytes25 p0) internal view
```

### logBytes26

```solidity
function logBytes26(bytes26 p0) internal view
```

### logBytes27

```solidity
function logBytes27(bytes27 p0) internal view
```

### logBytes28

```solidity
function logBytes28(bytes28 p0) internal view
```

### logBytes29

```solidity
function logBytes29(bytes29 p0) internal view
```

### logBytes30

```solidity
function logBytes30(bytes30 p0) internal view
```

### logBytes31

```solidity
function logBytes31(bytes31 p0) internal view
```

### logBytes32

```solidity
function logBytes32(bytes32 p0) internal view
```

### log

```solidity
function log(uint256 p0) internal view
```

### log

```solidity
function log(string p0) internal view
```

### log

```solidity
function log(bool p0) internal view
```

### log

```solidity
function log(address p0) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1) internal view
```

### log

```solidity
function log(uint256 p0, string p1) internal view
```

### log

```solidity
function log(uint256 p0, bool p1) internal view
```

### log

```solidity
function log(uint256 p0, address p1) internal view
```

### log

```solidity
function log(string p0, uint256 p1) internal view
```

### log

```solidity
function log(string p0, string p1) internal view
```

### log

```solidity
function log(string p0, bool p1) internal view
```

### log

```solidity
function log(string p0, address p1) internal view
```

### log

```solidity
function log(bool p0, uint256 p1) internal view
```

### log

```solidity
function log(bool p0, string p1) internal view
```

### log

```solidity
function log(bool p0, bool p1) internal view
```

### log

```solidity
function log(bool p0, address p1) internal view
```

### log

```solidity
function log(address p0, uint256 p1) internal view
```

### log

```solidity
function log(address p0, string p1) internal view
```

### log

```solidity
function log(address p0, bool p1) internal view
```

### log

```solidity
function log(address p0, address p1) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, uint256 p2) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, string p2) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, bool p2) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, address p2) internal view
```

### log

```solidity
function log(uint256 p0, string p1, uint256 p2) internal view
```

### log

```solidity
function log(uint256 p0, string p1, string p2) internal view
```

### log

```solidity
function log(uint256 p0, string p1, bool p2) internal view
```

### log

```solidity
function log(uint256 p0, string p1, address p2) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, uint256 p2) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, string p2) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, bool p2) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, address p2) internal view
```

### log

```solidity
function log(uint256 p0, address p1, uint256 p2) internal view
```

### log

```solidity
function log(uint256 p0, address p1, string p2) internal view
```

### log

```solidity
function log(uint256 p0, address p1, bool p2) internal view
```

### log

```solidity
function log(uint256 p0, address p1, address p2) internal view
```

### log

```solidity
function log(string p0, uint256 p1, uint256 p2) internal view
```

### log

```solidity
function log(string p0, uint256 p1, string p2) internal view
```

### log

```solidity
function log(string p0, uint256 p1, bool p2) internal view
```

### log

```solidity
function log(string p0, uint256 p1, address p2) internal view
```

### log

```solidity
function log(string p0, string p1, uint256 p2) internal view
```

### log

```solidity
function log(string p0, string p1, string p2) internal view
```

### log

```solidity
function log(string p0, string p1, bool p2) internal view
```

### log

```solidity
function log(string p0, string p1, address p2) internal view
```

### log

```solidity
function log(string p0, bool p1, uint256 p2) internal view
```

### log

```solidity
function log(string p0, bool p1, string p2) internal view
```

### log

```solidity
function log(string p0, bool p1, bool p2) internal view
```

### log

```solidity
function log(string p0, bool p1, address p2) internal view
```

### log

```solidity
function log(string p0, address p1, uint256 p2) internal view
```

### log

```solidity
function log(string p0, address p1, string p2) internal view
```

### log

```solidity
function log(string p0, address p1, bool p2) internal view
```

### log

```solidity
function log(string p0, address p1, address p2) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, uint256 p2) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, string p2) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, bool p2) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, address p2) internal view
```

### log

```solidity
function log(bool p0, string p1, uint256 p2) internal view
```

### log

```solidity
function log(bool p0, string p1, string p2) internal view
```

### log

```solidity
function log(bool p0, string p1, bool p2) internal view
```

### log

```solidity
function log(bool p0, string p1, address p2) internal view
```

### log

```solidity
function log(bool p0, bool p1, uint256 p2) internal view
```

### log

```solidity
function log(bool p0, bool p1, string p2) internal view
```

### log

```solidity
function log(bool p0, bool p1, bool p2) internal view
```

### log

```solidity
function log(bool p0, bool p1, address p2) internal view
```

### log

```solidity
function log(bool p0, address p1, uint256 p2) internal view
```

### log

```solidity
function log(bool p0, address p1, string p2) internal view
```

### log

```solidity
function log(bool p0, address p1, bool p2) internal view
```

### log

```solidity
function log(bool p0, address p1, address p2) internal view
```

### log

```solidity
function log(address p0, uint256 p1, uint256 p2) internal view
```

### log

```solidity
function log(address p0, uint256 p1, string p2) internal view
```

### log

```solidity
function log(address p0, uint256 p1, bool p2) internal view
```

### log

```solidity
function log(address p0, uint256 p1, address p2) internal view
```

### log

```solidity
function log(address p0, string p1, uint256 p2) internal view
```

### log

```solidity
function log(address p0, string p1, string p2) internal view
```

### log

```solidity
function log(address p0, string p1, bool p2) internal view
```

### log

```solidity
function log(address p0, string p1, address p2) internal view
```

### log

```solidity
function log(address p0, bool p1, uint256 p2) internal view
```

### log

```solidity
function log(address p0, bool p1, string p2) internal view
```

### log

```solidity
function log(address p0, bool p1, bool p2) internal view
```

### log

```solidity
function log(address p0, bool p1, address p2) internal view
```

### log

```solidity
function log(address p0, address p1, uint256 p2) internal view
```

### log

```solidity
function log(address p0, address p1, string p2) internal view
```

### log

```solidity
function log(address p0, address p1, bool p2) internal view
```

### log

```solidity
function log(address p0, address p1, address p2) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, string p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, string p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, string p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, bool p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, bool p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, address p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, address p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, uint256 p1, address p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, string p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, string p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, string p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, bool p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, bool p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, address p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, address p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, string p1, address p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, string p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, string p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, string p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, bool p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, bool p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, address p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, address p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, bool p1, address p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, string p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, string p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, string p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, bool p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, bool p2, address p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, address p2, string p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, address p2, bool p3) internal view
```

### log

```solidity
function log(uint256 p0, address p1, address p2, address p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, string p2, string p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, string p2, bool p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, string p2, address p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, bool p2, string p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, bool p2, address p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, address p2, string p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, address p2, bool p3) internal view
```

### log

```solidity
function log(string p0, uint256 p1, address p2, address p3) internal view
```

### log

```solidity
function log(string p0, string p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, string p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(string p0, string p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(string p0, string p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(string p0, string p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, string p1, string p2, string p3) internal view
```

### log

```solidity
function log(string p0, string p1, string p2, bool p3) internal view
```

### log

```solidity
function log(string p0, string p1, string p2, address p3) internal view
```

### log

```solidity
function log(string p0, string p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, string p1, bool p2, string p3) internal view
```

### log

```solidity
function log(string p0, string p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(string p0, string p1, bool p2, address p3) internal view
```

### log

```solidity
function log(string p0, string p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, string p1, address p2, string p3) internal view
```

### log

```solidity
function log(string p0, string p1, address p2, bool p3) internal view
```

### log

```solidity
function log(string p0, string p1, address p2, address p3) internal view
```

### log

```solidity
function log(string p0, bool p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, bool p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(string p0, bool p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(string p0, bool p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(string p0, bool p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, bool p1, string p2, string p3) internal view
```

### log

```solidity
function log(string p0, bool p1, string p2, bool p3) internal view
```

### log

```solidity
function log(string p0, bool p1, string p2, address p3) internal view
```

### log

```solidity
function log(string p0, bool p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, bool p1, bool p2, string p3) internal view
```

### log

```solidity
function log(string p0, bool p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(string p0, bool p1, bool p2, address p3) internal view
```

### log

```solidity
function log(string p0, bool p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, bool p1, address p2, string p3) internal view
```

### log

```solidity
function log(string p0, bool p1, address p2, bool p3) internal view
```

### log

```solidity
function log(string p0, bool p1, address p2, address p3) internal view
```

### log

```solidity
function log(string p0, address p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, address p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(string p0, address p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(string p0, address p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(string p0, address p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, address p1, string p2, string p3) internal view
```

### log

```solidity
function log(string p0, address p1, string p2, bool p3) internal view
```

### log

```solidity
function log(string p0, address p1, string p2, address p3) internal view
```

### log

```solidity
function log(string p0, address p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, address p1, bool p2, string p3) internal view
```

### log

```solidity
function log(string p0, address p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(string p0, address p1, bool p2, address p3) internal view
```

### log

```solidity
function log(string p0, address p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(string p0, address p1, address p2, string p3) internal view
```

### log

```solidity
function log(string p0, address p1, address p2, bool p3) internal view
```

### log

```solidity
function log(string p0, address p1, address p2, address p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, string p2, string p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, string p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, string p2, address p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, bool p2, string p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, bool p2, address p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, address p2, string p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, address p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, uint256 p1, address p2, address p3) internal view
```

### log

```solidity
function log(bool p0, string p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, string p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(bool p0, string p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, string p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(bool p0, string p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, string p1, string p2, string p3) internal view
```

### log

```solidity
function log(bool p0, string p1, string p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, string p1, string p2, address p3) internal view
```

### log

```solidity
function log(bool p0, string p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, string p1, bool p2, string p3) internal view
```

### log

```solidity
function log(bool p0, string p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, string p1, bool p2, address p3) internal view
```

### log

```solidity
function log(bool p0, string p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, string p1, address p2, string p3) internal view
```

### log

```solidity
function log(bool p0, string p1, address p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, string p1, address p2, address p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, string p2, string p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, string p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, string p2, address p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, bool p2, string p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, bool p2, address p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, address p2, string p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, address p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, bool p1, address p2, address p3) internal view
```

### log

```solidity
function log(bool p0, address p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, address p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(bool p0, address p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, address p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(bool p0, address p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, address p1, string p2, string p3) internal view
```

### log

```solidity
function log(bool p0, address p1, string p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, address p1, string p2, address p3) internal view
```

### log

```solidity
function log(bool p0, address p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, address p1, bool p2, string p3) internal view
```

### log

```solidity
function log(bool p0, address p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, address p1, bool p2, address p3) internal view
```

### log

```solidity
function log(bool p0, address p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(bool p0, address p1, address p2, string p3) internal view
```

### log

```solidity
function log(bool p0, address p1, address p2, bool p3) internal view
```

### log

```solidity
function log(bool p0, address p1, address p2, address p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, string p2, string p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, string p2, bool p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, string p2, address p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, bool p2, string p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, bool p2, address p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, address p2, string p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, address p2, bool p3) internal view
```

### log

```solidity
function log(address p0, uint256 p1, address p2, address p3) internal view
```

### log

```solidity
function log(address p0, string p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, string p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(address p0, string p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(address p0, string p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(address p0, string p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, string p1, string p2, string p3) internal view
```

### log

```solidity
function log(address p0, string p1, string p2, bool p3) internal view
```

### log

```solidity
function log(address p0, string p1, string p2, address p3) internal view
```

### log

```solidity
function log(address p0, string p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, string p1, bool p2, string p3) internal view
```

### log

```solidity
function log(address p0, string p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(address p0, string p1, bool p2, address p3) internal view
```

### log

```solidity
function log(address p0, string p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, string p1, address p2, string p3) internal view
```

### log

```solidity
function log(address p0, string p1, address p2, bool p3) internal view
```

### log

```solidity
function log(address p0, string p1, address p2, address p3) internal view
```

### log

```solidity
function log(address p0, bool p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, bool p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(address p0, bool p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(address p0, bool p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(address p0, bool p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, bool p1, string p2, string p3) internal view
```

### log

```solidity
function log(address p0, bool p1, string p2, bool p3) internal view
```

### log

```solidity
function log(address p0, bool p1, string p2, address p3) internal view
```

### log

```solidity
function log(address p0, bool p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, bool p1, bool p2, string p3) internal view
```

### log

```solidity
function log(address p0, bool p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(address p0, bool p1, bool p2, address p3) internal view
```

### log

```solidity
function log(address p0, bool p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, bool p1, address p2, string p3) internal view
```

### log

```solidity
function log(address p0, bool p1, address p2, bool p3) internal view
```

### log

```solidity
function log(address p0, bool p1, address p2, address p3) internal view
```

### log

```solidity
function log(address p0, address p1, uint256 p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, address p1, uint256 p2, string p3) internal view
```

### log

```solidity
function log(address p0, address p1, uint256 p2, bool p3) internal view
```

### log

```solidity
function log(address p0, address p1, uint256 p2, address p3) internal view
```

### log

```solidity
function log(address p0, address p1, string p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, address p1, string p2, string p3) internal view
```

### log

```solidity
function log(address p0, address p1, string p2, bool p3) internal view
```

### log

```solidity
function log(address p0, address p1, string p2, address p3) internal view
```

### log

```solidity
function log(address p0, address p1, bool p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, address p1, bool p2, string p3) internal view
```

### log

```solidity
function log(address p0, address p1, bool p2, bool p3) internal view
```

### log

```solidity
function log(address p0, address p1, bool p2, address p3) internal view
```

### log

```solidity
function log(address p0, address p1, address p2, uint256 p3) internal view
```

### log

```solidity
function log(address p0, address p1, address p2, string p3) internal view
```

### log

```solidity
function log(address p0, address p1, address p2, bool p3) internal view
```

### log

```solidity
function log(address p0, address p1, address p2, address p3) internal view
```

## WETH

### name

```solidity
string name
```

### symbol

```solidity
string symbol
```

### decimals

```solidity
uint8 decimals
```

### Approval

```solidity
event Approval(address src, address guy, uint256 wad)
```

### Transfer

```solidity
event Transfer(address src, address dst, uint256 wad)
```

### Deposit

```solidity
event Deposit(address dst, uint256 wad)
```

### Withdrawal

```solidity
event Withdrawal(address src, uint256 wad)
```

### balanceOf

```solidity
mapping(address &#x3D;&gt; uint256) balanceOf
```

### allowance

```solidity
mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) allowance
```

### fallback

```solidity
fallback() external payable
```

### receive

```solidity
receive() external payable
```

### deposit

```solidity
function deposit() public payable
```

### withdraw

```solidity
function withdraw(uint256 wad) public
```

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

### approve

```solidity
function approve(address guy, uint256 wad) public returns (bool)
```

### transfer

```solidity
function transfer(address dst, uint256 wad) public returns (bool)
```

### transferFrom

```solidity
function transferFrom(address src, address dst, uint256 wad) public returns (bool)
```

