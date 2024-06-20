# tonbags-contract

## Project structure

- `contracts` - source code of all the smart contracts of the project and their dependencies.
- `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
- `tests` - tests for the contracts.
- `scripts` - scripts used by the project, mainly the deployment scripts.

For generating ZK circuit and verifier contract, check: https://docs.ton.org/develop/dapps/tutorials/simple-zk-on-ton

## How to use

### Build

```sh
$ yarn blueprint build
```

### Test

```sh
$ yarn blueprint test
```

### Deploy

```sh
# https://github.com/ton-org/blueprint?tab=readme-ov-file#deploying-contracts
$ yarn blueprint run deployTonBags --testnet --tonconnect
```

### Run script

```sh
$ yarn blueprint run incrementTonBags --testnet --tonconnect
```

### Add a new contract

```sh
$ yarn blueprint create ContractName
```

## Deployment Address

### Testnet

https://testnet.tonviewer.com/kQCpLkWpNOK4vjpueE-ETvTrJdEDFFcAf3uiVEn9WtTow1Iu
https://testnet.tonscan.org/address/kQCpLkWpNOK4vjpueE-ETvTrJdEDFFcAf3uiVEn9WtTow1Iu

> For ton address translation, check https://ton.org/address
> For testnet info, check https://docs.ton.org/develop/smart-contracts/environment/testnet