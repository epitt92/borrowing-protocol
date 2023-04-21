// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

//import "hardhat/console.sol";

/// @title implements LinkedList structure used to store/operate sorted Troves
library LinkedAddressList {
  struct EntryLink {
    address prev;
    address next;
  }

  struct List {
    address _last;
    address _first;
    uint256 _size;
    mapping(address => EntryLink) _values;
  }

  function add(
    List storage _list,
    address _element,
    address _reference,
    bool _before
  ) internal returns (bool) {
    require(_reference == address(0x0) || _list._values[_reference].next != address(0x0), "79d3d _ref neither valid nor 0x");
    // the lement must not exist in order to be added
    EntryLink storage element_values = _list._values[_element];
    if (element_values.prev == address(0x0)) {
      // the list is empty
      if (_list._last == address(0x0)) {
        // if it is the first element in the list, it refers to itself to indicate this
        element_values.prev = _element;
        element_values.next = _element;
        // the new element is now officially the first
        _list._first = _element;
        // the new element is now officially the last
        _list._last = _element;
      } else {
        if (_before && (_reference == address(0x0) || _reference == _list._first)) {
          // the element should be added as the first element
          address first = _list._first;
          _list._values[first].prev = _element;
          element_values.prev = _element;
          element_values.next = first;
          _list._first = _element;
        } else if (!_before && (_reference == address(0x0) || _reference == _list._last)) {
          // the element should be added as the last element
          address last = _list._last;
          _list._values[last].next = _element;
          element_values.prev = last;
          element_values.next = _element;
          _list._last = _element;
        } else {
          // the element should be inserted in between two elements
          EntryLink memory ref = _list._values[_reference];
          if (_before) {
            element_values.prev = ref.prev;
            element_values.next = _reference;
            _list._values[_reference].prev = _element;
            _list._values[ref.prev].next = _element;
          } else {
            element_values.prev = _reference;
            element_values.next = ref.next;
            _list._values[_reference].next = _element;
            _list._values[ref.next].prev = _element;
          }
        }
      }
      _list._size = _list._size + 1;
      return true;
    }
    return false;
  }

  function remove(List storage _list, address _element) internal returns (bool) {
    EntryLink memory element_values = _list._values[_element];
    if (element_values.next != address(0x0)) {
      if (_element == _list._last && _element == _list._first) {
        // it is the last element in the list
        delete _list._last;
        delete _list._first;
      } else if (_element == _list._first) {
        // simplified process for removing the first element
        address next = element_values.next;
        _list._values[next].prev = next;
        _list._first = next;
      } else if (_element == _list._last) {
        // simplified process for removing the last element
        address new_list_last = element_values.prev;
        _list._last = new_list_last;
        _list._values[new_list_last].next = new_list_last;
      } else {
        // set the previous and next to point to each other
        address next = element_values.next;
        address prev = element_values.prev;
        _list._values[next].prev = prev;
        _list._values[prev].next = next;
      }
      // in any case, delete the element itself
      delete _list._values[_element];
      _list._size = _list._size - 1;
      return true;
    }
    return false;
  }
}
