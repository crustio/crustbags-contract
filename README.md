# crustbags-contract

## Project structure

- `contracts` - source code of all the smart contracts of the project and their dependencies.
- `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
- `tests` - tests for the contracts.
- `scripts` - scripts used by the project, mainly the deployment scripts.

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
$ yarn blueprint run deployCrustBags --testnet --tonconnect
```

### Run script

```sh
$ yarn blueprint run placeOrderToCrustBags --testnet --tonconnect
```

### Add a new contract

```sh
$ yarn blueprint create ContractName
```

## Deployment Address

### Testnet

https://testnet.tonviewer.com/EQBOOMNqG0rvNm6vFGfR4qZl48BTDw_gYefVI4DQ70t9GoPC
https://testnet.tonscan.org/address/EQBOOMNqG0rvNm6vFGfR4qZl48BTDw_gYefVI4DQ70t9GoPC

> For ton address translation, check https://ton.org/address
> For testnet info, check https://docs.ton.org/develop/smart-contracts/environment/testnet