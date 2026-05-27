// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Create2HookDeployer {
    event Deployed(address indexed deployed, bytes32 indexed salt);

    function deploy(bytes32 salt, bytes memory creationCode) external payable returns (address deployed) {
        assembly {
            deployed := create2(callvalue(), add(creationCode, 0x20), mload(creationCode), salt)
        }
        require(deployed != address(0), "CREATE2_DEPLOY_FAILED");
        emit Deployed(deployed, salt);
    }
}
