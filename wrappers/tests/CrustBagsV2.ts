import { ContractProvider, Cell, contractAddress } from '@ton/core';
import { CrustBags } from '../CrustBags';
import { CrustBagsConfig, crustBagsConfigToCell } from '../CrustBags';

export class CrustBagsV2 extends CrustBags {

  static createFromConfig(config: CrustBagsConfig, code: Cell, workchain = 0) {
    const data = crustBagsConfigToCell(config);
    const init = { code, data };
    return new CrustBagsV2(contractAddress(workchain, init), init);
  }
  
  async getSomeMethodV2(provider: ContractProvider) {
      const result = await provider.get('some_method_v2', []);
      return result.stack.readString();
  }

}