import { Address, beginCell, Cell, Dictionary, toNano } from '@ton/core';
import { CrustBags } from '../wrappers/CrustBags';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const storageContractCode = await compile('StorageContract');
    const crustBagsCode = await compile('CrustBags');
    const configParamsDict: Dictionary<bigint, Cell> = Dictionary.empty();
    const storageProviderWhitelistDict: Dictionary<Address, Cell> = Dictionary.empty();
    const senderAddress = provider.sender().address!;
    const crustBags = provider.open(
        CrustBags.createFromConfig(
            {
                adminAddress: senderAddress,
                treasuryAddress: senderAddress,
                storageContractCode,
                configParamsDict,
                storageProviderWhitelistDict,
            },
            crustBagsCode
        )
    );

    await crustBags.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(crustBags.address);

    console.log('address', crustBags.address.toString());
}
