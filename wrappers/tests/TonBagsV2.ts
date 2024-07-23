import { ContractProvider, Cell, contractAddress } from '@ton/core';
import { TonBags } from '../../wrappers/TonBags';
import { TonBagsConfig, tonBagsConfigToCell } from '../../wrappers/TonBags';

export class TonBagsV2 extends TonBags {

  static createFromConfig(config: TonBagsConfig, code: Cell, workchain = 0) {
    const data = tonBagsConfigToCell(config);
    const init = { code, data };
    return new TonBagsV2(contractAddress(workchain, init), init);
  }
  
  async getSomeMethodV2(provider: ContractProvider) {
      const result = await provider.get('some_method_v2', []);
      return result.stack.readString();
  }

}