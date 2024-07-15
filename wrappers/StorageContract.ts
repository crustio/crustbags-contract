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
import {
  op_recycle_undistributed_storage_fees, op_unregister_as_storage_provider, op_submit_storage_proof,
  op_register_as_storage_provider, op_claim_storage_rewards
} from './constants';

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

  async getBalance(provider: ContractProvider) {
      const { balance } = await provider.getState();
      return balance;
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
      await provider.internal(via, {
          value,
          sendMode: SendMode.PAY_GAS_SEPARATELY,
          body: beginCell().endCell(),
      });
  }

  async getOrderInfo(provider: ContractProvider) {
      const result = await provider.get('get_order_info', []);
      const torrentHash = result.stack.readBigNumber();
      const ownerAddress = result.stack.readAddress();
      const fileMerkleHash = result.stack.readBigNumber();
      const fileSizeInBytes = result.stack.readBigNumber();
      const storagePeriodInSec = result.stack.readBigNumber();
      const maxStorageProofSpanInSec = result.stack.readBigNumber();
      const treasuryAddress = result.stack.readAddress();
      const treasuryFeeRate = result.stack.readBigNumber();

      return [
        torrentHash, ownerAddress, fileMerkleHash, fileSizeInBytes, storagePeriodInSec, maxStorageProofSpanInSec, treasuryAddress, treasuryFeeRate
      ];
  }

  async getStarted(provider: ContractProvider) {
    const result = await provider.get('started', []);
    return result.stack.readBoolean();
  }

  async getPeriodFinish(provider: ContractProvider) {
    const result = await provider.get('get_period_finish', []);
    return result.stack.readBigNumber();
  }

  async getTotalStorageProviders(provider: ContractProvider) {
    const result = await provider.get('get_total_storage_providers', []);
    return result.stack.readBigNumber();
  }

  async getUndistributedRewards(provider: ContractProvider) {
    const result = await provider.get('get_undistributed_rewards', []);
    return result.stack.readBigNumber();
  }

  async getEarned(provider: ContractProvider, providerAddress: Address) {
      const result = await provider.get('earned', [
          { type: 'slice', cell: beginCell().storeAddress(providerAddress).endCell() },
      ]);
      return result.stack.readBigNumber();
  }

  async getLastProofValid(provider: ContractProvider, providerAddress: Address) {
    const result = await provider.get('get_last_proof_valid', [
        { type: 'slice', cell: beginCell().storeAddress(providerAddress).endCell() },
    ]);
    return result.stack.readBoolean();
  }

  async getNextProof(provider: ContractProvider, providerAddress: Address) {
    const result = await provider.get('get_next_proof', [
        { type: 'slice', cell: beginCell().storeAddress(providerAddress).endCell() },
    ]);
    return result.stack.readBigNumber();
  }

  async sendRecycleUndistributedStorageFees(
      provider: ContractProvider, via: Sender
  ) {
      const messsage = beginCell()
          .storeUint(op_recycle_undistributed_storage_fees, 32) // op
          .storeUint(0, 64) // queryId
          .endCell();

      await provider.internal(via, {
          sendMode: SendMode.PAY_GAS_SEPARATELY,
          body: messsage,
          value: toNano('0.1'),
      });
  }

  async sendRegisterAsStorageProvider(
    provider: ContractProvider, via: Sender
  ) {
      const messsage = beginCell()
          .storeUint(op_register_as_storage_provider, 32) // op
          .storeUint(0, 64) // queryId
          .endCell();

      await provider.internal(via, {
          sendMode: SendMode.PAY_GAS_SEPARATELY,
          body: messsage,
          value: toNano('0.1'),
      });
  }

  async sendUnregisterAsStorageProvider(
    provider: ContractProvider, via: Sender
  ) {
      const messsage = beginCell()
          .storeUint(op_unregister_as_storage_provider, 32) // op
          .storeUint(0, 64) // queryId
          .endCell();

      await provider.internal(via, {
          sendMode: SendMode.PAY_GAS_SEPARATELY,
          body: messsage,
          value: toNano('0.1'),
      });
  }

  async sendSubmitStorageProof(
    provider: ContractProvider, via: Sender, merkleRoot: bigint
  ) {
      const messsage = beginCell()
          .storeUint(op_submit_storage_proof, 32) // op
          .storeUint(0, 64) // queryId
          .storeRef(beginCell().storeUint(merkleRoot, 256).endCell())
          .endCell();

      await provider.internal(via, {
          sendMode: SendMode.PAY_GAS_SEPARATELY,
          body: messsage,
          value: toNano('0.1'),
      });
  }

  async sendClaimStorageRewards(
    provider: ContractProvider, via: Sender
  ) {
      const messsage = beginCell()
          .storeUint(op_claim_storage_rewards, 32) // op
          .storeUint(0, 64) // queryId
          .endCell();

      await provider.internal(via, {
          sendMode: SendMode.PAY_GAS_SEPARATELY,
          body: messsage,
          value: toNano('0.1'),
      });
  }
  
}
