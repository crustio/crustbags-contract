import {
    Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano
} from '@ton/core';

import { op_update_admin } from './constants';

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
    bagStorageContracts: Cell;
    storageContractCode: Cell;
};

export function tonBagsConfigToCell(config: TonBagsConfig): Cell {
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeRef(config.bagStorageContracts)
        .storeRef(config.storageContractCode)
        .endCell();
}

export const Opcodes = {
    increase: 0x7e8764ef,
};

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

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    static updateAdminMessage(newOwner: Address) {
        return beginCell()
            .storeUint(op_update_admin, 32)  // op
            .storeUint(0, 64) // queryId
            .storeAddress(newOwner)
            .endCell();
    }

    async sendUpdateAdmin(provider: ContractProvider, via: Sender, newOwner: Address) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: TonBags.updateAdminMessage(newOwner),
            value: toNano('0.1'),
        });
    }

    static placeStorageOrderMessage(fileSize: bigint, merkleHash: bigint) {
        const torrentInfo = beginCell()
            .storeUint(0, 32)  // piece_size
            .storeUint(fileSize, 64)
            .endCell();
        return beginCell()
            .storeRef(torrentInfo)
            .storeUint(merkleHash, 256)
            .endCell();;
    }
    
    async sendPlaceStorageOrder(
        provider: ContractProvider, via: Sender,
        fileSize: bigint, merkleHash: bigint, totalStorageFee: bigint
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: TonBags.placeStorageOrderMessage(fileSize, merkleHash),
            value: totalStorageFee + toNano('0.1'),
        });
    }

    async getAdminAddress(provider: ContractProvider) {
        const result = await provider.get('get_admin_address', []);
        return result.stack.readAddress();
    }

    async getStorageContractAddress(provider: ContractProvider, bagId: bigint) {
        const result = await provider.get('get_storage_contract_address', [
            { type: 'slice', cell: beginCell().storeInt(bagId, 256).endCell() },
        ]);
        return result.stack.readAddress();
    }

}