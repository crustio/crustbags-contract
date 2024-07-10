import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
} from '@ton/core';

export type StorageContractConfig = {};

export function storageContractConfigToCell(config: StorageContractConfig): Cell {
  return beginCell().endCell();
}

export class StorageContract implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
      return new StorageContract(address);
  }

  static createFromConfig(config: StorageContractConfig, code: Cell, workchain = 0) {
      const data = storageContractConfigToCell(config);
      const init = { code, data };
      return new StorageContract(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
      await provider.internal(via, {
          value,
          sendMode: SendMode.PAY_GAS_SEPARATELY,
          body: beginCell().endCell(),
      });
  }

  async getBagInfo(provider: ContractProvider) {
      const result = await provider.get('get_bag_info', []);
      const torrentHash = result.stack.readBigNumber();
      const ownerAddress = result.stack.readAddress();
      const fileMerkleHash = result.stack.readBigNumber();
      const fileSizeInBytes = result.stack.readBigNumber();

      return [
        torrentHash, ownerAddress, fileMerkleHash, fileSizeInBytes
      ];
  }

  async earned(provider: ContractProvider, providerAddress: Address) {
      const result = await provider.get('earned', [
          { type: 'slice', cell: beginCell().storeAddress(providerAddress).endCell() },
      ]);
      return result.stack.readAddressOpt();
  }
  
}
