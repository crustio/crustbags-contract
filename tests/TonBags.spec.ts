import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, Dictionary, beginCell, toNano } from '@ton/core';
import { TonBags } from '../wrappers/TonBags';
import { StorageContract } from '../wrappers/StorageContract';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import {
    error_unauthorized, error_not_enough_storage_fee, error_duplicated_torrent_hash,
    error_file_too_small, error_file_too_large
} from '../wrappers/constants';
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

        expect(await tonBags.getStorageContractAddress(torrentHash)).not.toBeNull();

        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'));
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_duplicated_torrent_hash,
            success: false
        });

        const torrentHash2 = BigInt('0x476848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11C');
        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash2, fileSize, merkleRoot, toNano('1'));
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            success: true
        });
        expect(await tonBags.getStorageContractAddress(torrentHash2)).not.toBeNull();
        expect(await tonBags.getStorageContractAddress(torrentHash)).not.toEqual(await tonBags.getStorageContractAddress(torrentHash2));

        const torrentHash3 = BigInt('0x476848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11D');
        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash3, 0n, merkleRoot, toNano('1'));
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_file_too_small,
            success: false
        });

        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash3, 1024n * 1024n * 1024n * 100n, merkleRoot, toNano('1'));
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_file_too_large,
            success: false
        });

        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash3, 1024n * 1024n * 100n, merkleRoot, toNano('0.01'));
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_not_enough_storage_fee,
            success: false
        });

    });

    it('storage contract works', async () => {
        const dataArray = [ 0x0BAD0010n, 0x60A70020n, 0xBEEF0030n, 0xDEAD0040n, 0xCA110050n, 0x0E660060n, 0xFACE0070n, 0xBAD00080n, 0x060D0091n ];
        const merkleRoot = getMerkleRoot(dataArray);
        const torrentHash = BigInt('0x676848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11B');
        const fileSize = 1024n * 1024n * 10n;  // 10MB

        expect(await tonBags.getStorageContractAddress(torrentHash)).toBeNull();
        let trans = await tonBags.sendPlaceStorageOrder(Bob.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'));
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            success: true
        });
        expect(await tonBags.getStorageContractAddress(torrentHash)).not.toBeNull();

        const storageContract = blockchain.openContract(
            StorageContract.createFromAddress(
                await tonBags.getStorageContractAddress(torrentHash) || Alice.address
            )
        );

        let [contractTorrentHash, ownerAddress, fileMerkleHash, fileSizeInBytes] = await storageContract.getBagInfo();
        expect(contractTorrentHash).toEqual(torrentHash);
        expect(ownerAddress).toEqualAddress(Bob.address);
        expect(fileMerkleHash).toEqual(merkleRoot);
        expect(fileSizeInBytes).toEqual(fileSize);
        expect(await storageContract.getEarned(Bob.address)).toEqual(0n);

    });


});
