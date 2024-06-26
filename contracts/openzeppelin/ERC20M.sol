// SPDX-License-Identifier: GPL-3.0-or-later
// solium-disable linebreak-style
pragma solidity ^0.8.9;

import "./ERC20.sol";

contract ERC20M is ERC20 {
  uint256 public constant initialSupply = 20000000000000000000000;

  constructor(string memory _name, string memory _symbol)
    ERC20(_name, _symbol)
  {
    _mint(msg.sender, initialSupply);
  }
}
