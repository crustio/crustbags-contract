import {
    Address, beginCell, Cell, Contract, Dictionary, contractAddress, ContractProvider, Sender, SendMode, toNano,
    Slice,
    BitString
} from '@ton/core';

import { op_update_admin, op_update_treasury, op_set_config_param, op_place_storage_order } from './constants';
import { calcChunkSize } from './proofsutils';

export type TonBagsContent = {
    type: 0 | 1;
    uri: string;
};

export function tonBagsContentToCell(content: TonBagsContent) {
    return beginCell()
        .storeUint(content.type, 8)
        .storeStringTail(content.uri)
        .endCell();
}

export type TonBagsConfig = {
    adminAddress: Address;
    treasuryAddress: Address;
    storageContractCode: Cell;
    configParamsDict: Dictionary<bigint, Cell>;
};

export function tonBagsConfigToCell(config: TonBagsConfig): Cell {
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.treasuryAddress)
        .storeRef(config.storageContractCode)
        .storeDict(config.configParamsDict)
        .endCell();
}

export class TonBags implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new TonBags(address);
    }

    static createFromConfig(config: TonBagsConfig, code: Cell, workchain = 0) {
        const data = tonBagsConfigToCell(config);
        const init = { code, data };
        return new TonBags(contractAddress(workchain, init), init);
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

    async sendUpdateAdmin(provider: ContractProvider, via: Sender, newOwner: Address) {
        const msg = beginCell()
        .storeUint(op_update_admin, 32)  // op
        .storeUint(0, 64) // queryId
        .storeAddress(newOwner)
        .endCell();

        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg,
            value: toNano('0.1'),
        });
    }

    async sendUpdateTreasury(provider: ContractProvider, via: Sender, newTreasury: Address) {
        const msg = beginCell()
        .storeUint(op_update_treasury, 32)  // op
        .storeUint(0, 64) // queryId
        .storeAddress(newTreasury)
        .endCell();

        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg,
            value: toNano('0.1'),
        });
    }

    async sendSetConfigParam(provider: ContractProvider, via: Sender, param: bigint, value: bigint) {
        const msg = beginCell()
        .storeUint(op_set_config_param, 32)  // op
        .storeUint(0, 64) // queryId
        .storeUint(param, 256)
        .storeUint(value, 64)
        .endCell();

        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg,
            value: toNano('0.1'),
        });
    }

    static placeStorageOrderMessage(torrentHash: bigint, fileSize: bigint, merkleHash: bigint, chunkSize: bigint, totalStorageFee: bigint, storagePeriodInSec: bigint) {
        return beginCell()
            .storeUint(op_place_storage_order, 32)  // op
            .storeUint(0, 64) // queryId
            .storeUint(torrentHash, 256)
            .storeUint(fileSize, 64)
            .storeUint(merkleHash, 256)
            .storeUint(chunkSize, 32)
            .storeCoins(totalStorageFee)
            .storeUint(storagePeriodInSec, 256)
            .endCell();;
    }
    
    async sendPlaceStorageOrder(
        provider: ContractProvider, via: Sender, torrentHash: bigint,
        fileSize: bigint, merkleHash: bigint, totalStorageFee: bigint, storagePeriodInSec: bigint
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: TonBags.placeStorageOrderMessage(torrentHash, fileSize, merkleHash, calcChunkSize(fileSize), totalStorageFee, storagePeriodInSec),
            value: totalStorageFee + toNano('0.1'),
        });
    }

    async getAdminAddress(provider: ContractProvider) {
        const result = await provider.get('get_admin_address', []);
        return result.stack.readAddress();
    }

    async getTreasuryAddress(provider: ContractProvider) {
        const result = await provider.get('get_treasury_address', []);
        return result.stack.readAddress();
    }

    async getConfigParam(
        provider: ContractProvider, param: bigint
    ) {
        const result = await provider.get('get_param_value', [
            {type: 'int', value: param}
        ]);
        return result.stack.readBigNumber();
    }

    async getStorageContractAddress(
        provider: ContractProvider, 
        storageContractCode: Cell, ownerAddress: Address,
        torrentHash: bigint, fileSize: bigint, merkleHash: bigint, initialStorageFee: bigint,
        storagePeriodInSec: bigint, maxStorageProofSpanInSec: bigint,
        treasuryAddress: Address, treasuryFeeRate: bigint
    ) {
        
        const result = await provider.get('get_storage_contract_address', [
            {type: 'cell', cell: storageContractCode},
            {type: 'slice', cell: beginCell().storeAddress(ownerAddress).endCell()},
            {type: 'int', value: torrentHash},
            {type: 'int', value: fileSize},
            {type: 'int', value: merkleHash},
            {type: 'int', value: calcChunkSize(fileSize)},
            {type: 'int', value: initialStorageFee},
            {type: 'int', value: storagePeriodInSec},
            {type: 'int', value: maxStorageProofSpanInSec},
            {type: 'slice', cell: beginCell().storeAddress(treasuryAddress).endCell()},
            {type: 'int', value: treasuryFeeRate}
        ]);
        return result.stack.readAddress();
    }

}