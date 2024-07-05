import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, beginCell, toNano } from '@ton/core';
import { TonBags } from '../wrappers/TonBags';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { error_unauthorized } from '../wrappers/constants';

describe('TonBags', () => {
    let tonBagsCode: Cell;
    let storageContractCode: Cell;

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let notDeployer: SandboxContract<TreasuryContract>;
    let tonBags: SandboxContract<TonBags>;

    let defaultContent: Cell;

    beforeAll(async () => {
        tonBagsCode = await compile('TonBags');
        storageContractCode = await compile('StorageContract');

        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        notDeployer = await blockchain.treasury('notDeployer');
        defaultContent = beginCell().endCell();

        tonBags = blockchain.openContract(
            TonBags.createFromConfig(
                {
                    adminAddress: deployer.address,
                    bagStorageContracts: defaultContent,
                    storageContractCode,
                },
                tonBagsCode
            )
        );
        
        const deployResult = await tonBags.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: tonBags.address,
            deploy: true,
            success: true
        });
    });


    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and tonBags are ready to use
    });

    it('minter admin can change admin', async () => {
        // console.log('Deployer: ', deployer.address);
        // console.log('Not Deployer: ', notDeployer.address);
        expect((await tonBags.getAdminAddress()).equals(deployer.address)).toBe(true);

        let changeAdmin = await tonBags.sendUpdateAdmin(deployer.getSender(), notDeployer.address);
        expect((await tonBags.getAdminAddress()).equals(notDeployer.address)).toBe(true);

        changeAdmin = await tonBags.sendUpdateAdmin(notDeployer.getSender(), deployer.address);
        expect((await tonBags.getAdminAddress()).equals(deployer.address)).toBe(true);
    });

    it('not a minter admin can not change admin', async () => {
        let changeAdmin = await tonBags.sendUpdateAdmin(notDeployer.getSender(), notDeployer.address);
        expect((await tonBags.getAdminAddress()).equals(deployer.address)).toBe(true);
        expect(changeAdmin.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_unauthorized
        });
    });
});
