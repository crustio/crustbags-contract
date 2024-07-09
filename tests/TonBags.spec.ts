import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, Dictionary, beginCell, toNano } from '@ton/core';
import { TonBags } from '../wrappers/TonBags';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { error_unauthorized } from '../wrappers/constants';
import { getMerkleRoot } from "./merkleProofUtils";

describe('TonBags', () => {
    let tonBagsCode: Cell;
    let storageContractCode: Cell;

    let blockchain: Blockchain;
    let Alice: SandboxContract<TreasuryContract>;
    let Bob: SandboxContract<TreasuryContract>;
    let Caro: SandboxContract<TreasuryContract>;
    let tonBags: SandboxContract<TonBags>;

    let emptyBagStorageContractDict: Dictionary<number, Address>;

    beforeAll(async () => {
        tonBagsCode = await compile('TonBags');
        storageContractCode = await compile('StorageContract');

        blockchain = await Blockchain.create();
        Alice = await blockchain.treasury('Alice');
        Bob = await blockchain.treasury('Bob');
        Caro = await blockchain.treasury('Caro');
        // emptyBagStorageContractDict = beginCell().endCell();
        emptyBagStorageContractDict = Dictionary.empty();

        tonBags = blockchain.openContract(
            TonBags.createFromConfig(
                {
                    adminAddress: Alice.address,
                    storageContractCode,
                    bagStorageContractDict: emptyBagStorageContractDict,
                },
                tonBagsCode
            )
        );
        
        const deployResult = await tonBags.sendDeploy(Alice.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: Alice.address,
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
        expect(await tonBags.getAdminAddress()).toEqualAddress(Alice.address);

        let changeAdmin = await tonBags.sendUpdateAdmin(Alice.getSender(), Bob.address);
        expect(await tonBags.getAdminAddress()).toEqualAddress(Bob.address);

        changeAdmin = await tonBags.sendUpdateAdmin(Bob.getSender(), Alice.address);
        expect(await tonBags.getAdminAddress()).toEqualAddress(Alice.address);
    });

    it('not a minter admin can not change admin', async () => {
        let changeAdmin = await tonBags.sendUpdateAdmin(Bob.getSender(), Bob.address);
        expect(await tonBags.getAdminAddress()).toEqualAddress(Alice.address);
        expect(changeAdmin.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_unauthorized
        });
    });

    it('anyone could place order to create a storage contract', async () => {
        const dataArray = [
            0x0BAD0010n,
            0x60A70020n,
            0xBEEF0030n,
            0xDEAD0040n,
            0xCA110050n,
            0x0E660060n,
            0xFACE0070n,
            0xBAD00080n,
            0x060D0091n
        ];
        const merkleRoot = getMerkleRoot(dataArray);
        const torrentHash = BigInt('0x476848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11B');
        const fileSize = 1024n * 1024n * 10n;  // 10MB

        expect(await tonBags.getStorageContractAddress(torrentHash)).toBeNull();

        let trans = await tonBags.sendPlaceStorageOrder(Bob.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'));
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            success: true
        });

        // console.log(await tonBags.getStorageContractAddress(torrentHash));
        expect(await tonBags.getStorageContractAddress(torrentHash)).not.toBeNull();
        
    });

});
