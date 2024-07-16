import { Cell, Dictionary, toNano } from '@ton/core';
import { TonBags } from '../wrappers/TonBags';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const storageContractCode = await compile('StorageContract');
    const tonBagCode = await compile('TonBags');
    const configParamsDict: Dictionary<bigint, Cell> = Dictionary.empty();
    const senderAddress = provider.sender().address!;
    const tonBags = provider.open(
        TonBags.createFromConfig(
            {
                adminAddress: senderAddress,
                treasuryAddress: senderAddress,
                storageContractCode,
                configParamsDict
            },
            tonBagCode
        )
    );

    await tonBags.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(tonBags.address);

    console.log('address', tonBags.address.toString());
}
