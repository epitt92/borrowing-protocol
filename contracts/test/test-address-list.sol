//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../utils/linked-address-list.sol";

contract TestAddressList {
  using LinkedAddressList for LinkedAddressList.List;

  LinkedAddressList.List private _addressList;

  function addressListElement(address _element) public view returns (LinkedAddressList.EntryLink memory) {
    return _addressList._values[_element];
  }

  function lastAddressListElement() public view returns (address) {
    return _addressList._last;
  }

  function firstAddressListElement() public view returns (address) {
    return _addressList._first;
  }

  function addressListSize() public view returns (uint256) {
    return _addressList._size;
  }

  function appendAddress(address newAddress) public {
    require(_addressList.add(newAddress, address(0x0), false), "adding the list element failed");
  }

  function addAddress(
    address newAddress,
    address _reference,
    bool before
  ) public {
    require(_addressList.add(newAddress, _reference, before), "adding the list element failed");
  }

  function removeAddress(address _existingElement) public {
    require(_addressList.remove(_existingElement), "removing the list element failed");
  }
}
