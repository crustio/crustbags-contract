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
    admin_address: Address;
    bag_storage_contracts: Cell;
    storage_contract_code: Cell;
};

export function tonBagsConfigToCell(config: TonBagsConfig): Cell {
    return beginCell()
        .storeAddress(config.admin_address)
        .storeRef(config.bag_storage_contracts)
        .storeRef(config.storage_contract_code)
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
            .storeUint(op_update_admin, 32)
            .storeUint(0, 64) // op, queryId
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
}