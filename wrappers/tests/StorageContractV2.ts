import { ContractProvider } from '@ton/core';
import { StorageContract } from '../../wrappers/StorageContract';

export class StorageContractV2 extends StorageContract {
  
  async getSomeMethodV2(provider: ContractProvider) {
      const result = await provider.get('some_method_v2', []);
      return result.stack.readString();
  }

}
