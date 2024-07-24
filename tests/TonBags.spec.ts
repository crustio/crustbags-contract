import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, Dictionary, beginCell, toNano, fromNano } from '@ton/core';
import { TonBags } from '../wrappers/TonBags';
import { StorageContract } from '../wrappers/StorageContract';
import { TonBagsV2 } from '../wrappers/tests/TonBagsV2';
import {
    error_unauthorized, error_not_enough_storage_fee, error_duplicated_torrent_hash,
    error_file_too_small, error_file_too_large, error_storage_order_unexpired, error_unregistered_storage_provider,
    op_recycle_undistributed_storage_fees, op_unregister_as_storage_provider, op_submit_storage_proof, op_set_config_param,
    op_register_as_storage_provider, op_claim_storage_rewards, op_update_treasury, config_min_storage_period_in_sec,
    config_max_storage_proof_span_in_sec, error_too_short_storage_period, config_treasury_fee_rate, config_max_storage_providers_per_order,
    op_place_storage_order, op_upgrade, op_update_storage_contract_code, default_max_storage_providers_per_order,
    default_max_storage_proof_span, default_storage_period,
    op_add_storage_provider_to_white_list, error_max_storage_providers_per_order_exceeded
} from '../wrappers/constants';
import { getMerkleRoot } from "./merkleProofUtils";
import { ONE_HOUR_IN_SECS, expectBigNumberEquals } from "./utils";
import { createReadStream } from 'fs';
import path from 'path';
import { MerkleTree } from '../wrappers/proofsutils';

const readAsBlob = async (file: string) => { 
    // return openAsBlob(file);
    return new Promise<Blob>((resolve, reject) => {
        let chunks: Buffer[] = []
        createReadStream(file).on('error', reject).on('data', (data: Buffer) => {
            chunks.push(data)
        }).on('end', () => resolve(new Blob(chunks)));
    });
};

describe('TonBags', () => {
    let tonBagsCode: Cell;
    let storageContractCode: Cell;

    let blockchain: Blockchain;
    let Treasury: SandboxContract<TreasuryContract>;
    let Alice: SandboxContract<TreasuryContract>;
    let Bob: SandboxContract<TreasuryContract>;
    let Caro: SandboxContract<TreasuryContract>;
    let Dave: SandboxContract<TreasuryContract>;
    let Eva: SandboxContract<TreasuryContract>;
    let tonBags: SandboxContract<TonBags>;
    let configParamsDict: Dictionary<bigint, Cell>;
    let storageProviderWhitelistDict: Dictionary<Address, Cell>;

    beforeEach(async () => {
        tonBagsCode = await compile('TonBags');
        storageContractCode = await compile('StorageContract');

        blockchain = await Blockchain.create();
        Treasury = await blockchain.treasury('Treasury');
        Alice = await blockchain.treasury('Alice');
        Bob = await blockchain.treasury('Bob');
        Caro = await blockchain.treasury('Caro');
        Dave = await blockchain.treasury('Dave');
        Eva = await blockchain.treasury('Eva');
        configParamsDict = Dictionary.empty();
        storageProviderWhitelistDict = Dictionary.empty();

        tonBags = blockchain.openContract(
            TonBags.createFromConfig(
                {
                    adminAddress: Alice.address,
                    treasuryAddress: Treasury.address,
                    storageContractCode,
                    configParamsDict,
                    storageProviderWhitelistDict
                },
                tonBagsCode
            )
        );

        const deployResult = await tonBags.sendDeploy(Alice.getSender(), toNano('0.1'));
        expect(deployResult.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            deploy: true,
            success: true
        });
        let trans = await tonBags.sendSetConfigParam(Alice.getSender(), BigInt(config_min_storage_period_in_sec), 60n * 60n * 24n * 7n);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            op: op_set_config_param,
            success: true,
        });
        trans = await tonBags.sendSetConfigParam(Alice.getSender(), BigInt(config_max_storage_proof_span_in_sec), BigInt(ONE_HOUR_IN_SECS));
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            op: op_set_config_param,
            success: true,
        });
        trans = await tonBags.sendSetConfigParam(Alice.getSender(), BigInt(config_treasury_fee_rate), 100n);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            op: op_set_config_param,
            success: true,
        });

        // https://github.com/ton-org/sandbox?tab=readme-ov-file#viewing-logs
        await blockchain.setVerbosityForAddress(tonBags.address, {
            print: true,
            blockchainLogs: false,
            vmLogs: 'none',  // 'none' | 'vm_logs' | 'vm_logs_full'
            debugLogs: true
        })
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and tonBags are ready to use
    });

    it('tonbags should be upgradable', async () => {
        const tonBagsCodeV2 = await compile('tests/TonBagsV2');
        const storageContractCodeV2 = await compile('tests/StorageContractV2');

        expect(await tonBags.getAdminAddress()).toEqualAddress(Alice.address);

        let trans = await tonBags.sendUpdateStorageContractCode(Bob.getSender(), storageContractCodeV2);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_unauthorized
        });
        trans = await tonBags.sendUpdateStorageContractCode(Alice.getSender(), storageContractCodeV2);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            op: op_update_storage_contract_code,
            success: true,
        });

        trans = await tonBags.sendUpgrade(Bob.getSender(), tonBagsCodeV2);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_unauthorized
        });
        trans = await tonBags.sendUpgrade(Alice.getSender(), tonBagsCodeV2);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            op: op_upgrade,
            success: true,
        });

        const tonBagsV2 = blockchain.openContract(
            TonBagsV2.createFromConfig(
                {
                    adminAddress: Alice.address,
                    treasuryAddress: Treasury.address,
                    storageContractCode,
                    configParamsDict,
                    storageProviderWhitelistDict
                },
                tonBagsCode
            )
        );
        expect(await tonBagsV2.getSomeMethodV2()).toEqual("Hello, TonBags V2!");
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

    it('admin can update treasury and config parameters', async () => {
        expect(await tonBags.getAdminAddress()).toEqualAddress(Alice.address);
        expect(await tonBags.getTreasuryAddress()).toEqualAddress(Treasury.address);

        let newTreasury = await blockchain.treasury('New Treasury');

        let trans = await tonBags.sendUpdateTreasury(Bob.getSender(), newTreasury.address);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_unauthorized
        });
        expect(await tonBags.getTreasuryAddress()).toEqualAddress(Treasury.address);

        trans = await tonBags.sendUpdateTreasury(Alice.getSender(), newTreasury.address);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            op: op_update_treasury,
            success: true
        });
        expect(await tonBags.getTreasuryAddress()).toEqualAddress(newTreasury.address);

        trans = await tonBags.sendSetConfigParam(Bob.getSender(), BigInt(config_min_storage_period_in_sec), 60n * 60n * 24n * 1n);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_unauthorized
        });
        trans = await tonBags.sendSetConfigParam(Alice.getSender(), BigInt(config_min_storage_period_in_sec), 60n * 60n * 24n * 1n);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            op: op_set_config_param,
            success: true,
        });
        expect(await tonBags.getConfigParam(BigInt(config_min_storage_period_in_sec), 0n)).toEqual(60n * 60n * 24n * 1n);
    });

    it('anyone could place order to create a storage contract', async () => {
        const file = await readAsBlob(path.join(__dirname,'/.files/test.zip'));
        const fileSize = BigInt(file.size);
        const mt = new MerkleTree()
        const [merkleRoot] = await mt.genTree(file);
        // const merkleRoot = getMerkleRoot(dataArray);
        const torrentHash = BigInt('0x476848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11B');
        // const fileSize = 1024n * 1024n * 10n;  // 10MB

        let trans = await tonBags.sendPlaceStorageOrder(Bob.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'), default_storage_period);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            success: true
        });

        // trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'));
        // expect(trans.transactions).toHaveTransaction({
        //     from: Caro.address,
        //     to: tonBags.address,
        //     aborted: true,
        //     exitCode: error_duplicated_torrent_hash,
        //     success: false
        // });

        const torrentHash2 = BigInt('0x476848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11C');
        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash2, fileSize, merkleRoot, toNano('1'), default_storage_period);
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            success: true
        });

        const torrentHash3 = BigInt('0x476848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11D');
        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash3, 0n, merkleRoot, toNano('1'), default_storage_period);
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_file_too_small,
            success: false
        });

        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash3, 1024n * 1024n * 1024n * 100n, merkleRoot, toNano('1'), default_storage_period);
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_file_too_large,
            success: false
        });

        trans = await tonBags.sendPlaceStorageOrder(Caro.getSender(), torrentHash3, 1024n * 1024n * 100n, merkleRoot, toNano('0.0001'), default_storage_period);
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_not_enough_storage_fee,
            success: false
        });

    });

    it('updated config params works for new storage contracts', async () => {
        const dataArray = [0x0BAD0010n, 0x60A70020n, 0xBEEF0030n, 0xDEAD0040n, 0xCA110050n, 0x0E660060n, 0xFACE0070n, 0xBAD00080n, 0x060D0091n];
        const merkleRoot = getMerkleRoot(dataArray);
        const torrentHash = BigInt('0x876848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11B');
        const fileSize = 1024n * 1024n * 10n;  // 10MB

        // Storage periods with 1/2 day does not work (< minimal 7 days)
        let trans = await tonBags.sendPlaceStorageOrder(Bob.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'), 60n * 60n * 24n / 2n);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_too_short_storage_period,
            success: false
        });

        // Storage periods with 30 days works
        let maxStorageProofSpan = await tonBags.getConfigParam(BigInt(config_max_storage_proof_span_in_sec), 0n);
        trans = await tonBags.sendPlaceStorageOrder(Bob.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'), 60n * 60n * 24n * 30n);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            op: op_place_storage_order,
            success: true
        });
        console.log(`Max storage providers per order: ${await tonBags.getConfigParam(BigInt(config_max_storage_providers_per_order), 0n)}`);
        let calStorageContractAddress = await tonBags.getStorageContractAddress(
            storageContractCode, Bob.address, torrentHash, fileSize, merkleRoot, toNano('1'), 60n * 60n * 24n * 30n, maxStorageProofSpan,
            Treasury.address, await tonBags.getConfigParam(BigInt(config_treasury_fee_rate), 0n),
            await tonBags.getConfigParam(BigInt(config_max_storage_providers_per_order), default_max_storage_providers_per_order),
            await tonBags.getStorageProviderWhitelistDict()
        );
        let storageContract = blockchain.openContract(
            StorageContract.createFromAddress(
                calStorageContractAddress
            )
        );
        console.log(`Storage contract address: ${storageContract.address}, balance: ${fromNano(await storageContract.getBalance())}`);

        // Placing storage orders with same parameters just double the balance
        trans = await tonBags.sendPlaceStorageOrder(Bob.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'), 60n * 60n * 24n * 30n);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            op: op_place_storage_order,
            success: true
        });
        console.log(`Storage contract address: ${storageContract.address}, balance: ${fromNano(await storageContract.getBalance())}`);

        // Check parameters
        let [
            contractTorrentHash, ownerAddress, fileMerkleHash, fileSizeInBytes, storagePeriodInSec, maxStorageProofSpanInSec,
            treasuryAddress, treasuryFeeRate, maxStorageProvidersPerOrder, storageProviderWhitelistDict
        ] = await storageContract.getOrderInfo();
        expect(maxStorageProofSpanInSec).toEqual(maxStorageProofSpan);

        // Check whitelist
        expect(await storageContract.getIsStorageProviderWhitelisted(Alice.address)).toBeFalsy();

        // Update parameters
        let newMaxStorageProofSpan = 60n * 60n / 2n;
        trans = await tonBags.sendSetConfigParam(Alice.getSender(), BigInt(config_max_storage_proof_span_in_sec), newMaxStorageProofSpan);
        expect(await tonBags.getConfigParam(BigInt(config_max_storage_proof_span_in_sec), 0n)).toEqual(newMaxStorageProofSpan);

        // Add Alice to whitelist
        trans = await tonBags.sendAddStorageProviderToWhitelist(Bob.getSender(), Alice.address);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            aborted: true,
            exitCode: error_unauthorized
        });
        trans = await tonBags.sendAddStorageProviderToWhitelist(Alice.getSender(), Alice.address);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: tonBags.address,
            op: op_add_storage_provider_to_white_list,
            success: true
        });
        expect(await storageContract.getIsStorageProviderWhitelisted(Alice.address)).toBeFalsy();
        // console.log(`Alice white listed: ${await tonBags.getIsStorageProviderWhitelisted(Alice.address)}`);
        expect(await tonBags.getIsStorageProviderWhitelisted(Alice.address)).toBeTruthy();

        // Deploy a new storage contract with updated parameters
        trans = await tonBags.sendPlaceStorageOrder(Bob.getSender(), torrentHash, fileSize, merkleRoot, toNano('1'), 60n * 60n * 24n * 30n);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: tonBags.address,
            op: op_place_storage_order,
            success: true
        });
        let calStorageContractAddress2 = await tonBags.getStorageContractAddress(
            storageContractCode, Bob.address, torrentHash, fileSize, merkleRoot, toNano('1'), 60n * 60n * 24n * 30n, newMaxStorageProofSpan,
            Treasury.address, await tonBags.getConfigParam(BigInt(config_treasury_fee_rate), 0n),
            await tonBags.getConfigParam(BigInt(config_max_storage_providers_per_order), default_max_storage_providers_per_order),
            await tonBags.getStorageProviderWhitelistDict()
        );
        expect(calStorageContractAddress2).not.toEqual(calStorageContractAddress);
        let storageContract2 = blockchain.openContract(
            StorageContract.createFromAddress(
                calStorageContractAddress2
            )
        );
        [
            contractTorrentHash, ownerAddress, fileMerkleHash, fileSizeInBytes, storagePeriodInSec, maxStorageProofSpanInSec,
            treasuryAddress, treasuryFeeRate, maxStorageProvidersPerOrder, storageProviderWhitelistDict
        ] = await storageContract2.getOrderInfo();
        expect(await storageContract2.getIsStorageProviderWhitelisted(Alice.address)).toBeTruthy();
        expect(maxStorageProofSpanInSec).toEqual(newMaxStorageProofSpan);
    });

    it('storage contract works', async () => {
        // Set default_max_storage_providers_per_order to 3
        let trans = await tonBags.sendSetConfigParam(Alice.getSender(), BigInt(config_max_storage_providers_per_order), 3n);

        // Add Caro & Eva to whitelist
        trans = await tonBags.sendAddStorageProviderToWhitelist(Alice.getSender(), Caro.address);
        trans = await tonBags.sendAddStorageProviderToWhitelist(Alice.getSender(), Eva.address);

        console.log(fromNano(await tonBags.getBalance()));
        const tonBagsBalanceBeforeDeployStorageContract = await tonBags.getBalance();

        const file = await readAsBlob(path.join(__dirname,'/.files/test.zip'));
        const fileSize = BigInt(file.size);
        const mt =  new MerkleTree()
        const tree = await mt.genTree(file);
        const [merkleRoot] = tree;// 23331377164405929771224926192798026045374831005425359019829938282733435242804
        // const dataArray = [0x0BAD0010n, 0x60A70020n, 0xBEEF0030n, 0xDEAD0040n, 0xCA110050n, 0x0E660060n, 0xFACE0070n, 0xBAD00080n, 0x060D0091n ];
        // const merkleRoot = getMerkleRoot(dataArray);
        const someInvalidMerkleRoot = merkleRoot - 1n;
        const torrentHash = BigInt('0x676848C3350EA64ACCC09218917132998267F2ABC283097082FD41D511CAF11B');
        // const fileSize = 1024n * 1024n * 10n;  // 10MB
        // Distribute 43.2 $TON over 180 days. Workers must submit their report at most every 1 hour
        // 1 day rewards: 43.2 / 180 = 0.24 $TON
        // 1 hour rewards: 0.24 / 24 = 0.01
        const totalStorageFee = toNano('86.4');
        const newStoragePeriodInSec = default_storage_period * 2n;
        trans = await tonBags.sendPlaceStorageOrder(Dave.getSender(), torrentHash, fileSize, merkleRoot, totalStorageFee, newStoragePeriodInSec);
        expect(trans.transactions).toHaveTransaction({
            from: Dave.address,
            to: tonBags.address,
            success: true
        });
        // let maxStorageProofSpan = await tonBags.getConfigParam(BigInt(config_max_storage_proof_span_in_sec));
        // console.log('maxStorageProofSpan: ', maxStorageProofSpan);
        const storageFeeRate = await tonBags.getConfigParam(BigInt(config_treasury_fee_rate), 0n);
        const calStorageContractAddress = await tonBags.getStorageContractAddress(
            storageContractCode, Dave.address, torrentHash, fileSize, merkleRoot, totalStorageFee, newStoragePeriodInSec,
            await tonBags.getConfigParam(BigInt(config_max_storage_proof_span_in_sec), default_max_storage_proof_span),
            Treasury.address, storageFeeRate,
            await tonBags.getConfigParam(BigInt(config_max_storage_providers_per_order), default_max_storage_providers_per_order),
            await tonBags.getStorageProviderWhitelistDict()
        );

        const storageContract = blockchain.openContract(
            StorageContract.createFromAddress(
                calStorageContractAddress
            )
        );

        let [
            contractTorrentHash, ownerAddress, fileMerkleHash, fileSizeInBytes, storagePeriodInSec, maxStorageProofSpanInSec,
            treasuryAddress, treasuryFeeRate, maxStorageProvidersPerOrder, storageProviderWhitelistDict
        ] = await storageContract.getOrderInfo();
        expect(contractTorrentHash).toEqual(torrentHash);
        expect(ownerAddress).toEqualAddress(Dave.address);
        expect(fileMerkleHash).toEqual(merkleRoot);
        expect(fileSizeInBytes).toEqual(fileSize);
        expect(storagePeriodInSec).toEqual(newStoragePeriodInSec);
        // console.log('maxStorageProofSpanInSec: ', maxStorageProofSpanInSec);
        // expect(maxStorageProofSpanInSec).toEqual(default_max_storage_proof_span);
        expect(await storageContract.getEarned(Alice.address)).toEqual(0n);

        console.log(fromNano(await tonBags.getBalance()));
        console.log(fromNano(await storageContract.getBalance()));

        // TonBags balance should remain unchanged
        // expect(await tonBags.getBalance()).toEqual(tonBagsBalanceBeforeDeployStorageContract);
        expectBigNumberEquals(tonBagsBalanceBeforeDeployStorageContract, await tonBags.getBalance());

        // Storage fees and remaining gas should go to new storage contract
        expect(await storageContract.getBalance()).toBeGreaterThan(totalStorageFee);

        // Not started until first registered storage provider
        expect(await storageContract.getStarted()).toBeFalsy();
        expect(await storageContract.getPeriodFinish()).toEqual(0n);

        // Can't recycle pool before start or finish
        trans = await storageContract.sendRecycleUndistributedStorageFees(Dave.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Dave.address,
            to: storageContract.address,
            aborted: true,
            exitCode: error_storage_order_unexpired,
            success: false
        });

        // Storage providers can't exit or submit work report before register
        trans = await storageContract.sendUnregisterAsStorageProvider(Alice.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            aborted: true,
            exitCode: error_unregistered_storage_provider,
            success: false
        });
        expect(await storageContract.getNextProof(Alice.address)).toEqual(-1n);
        let proofs = await mt.getDataAndProofs(file, 0);
        trans = await storageContract.sendSubmitStorageProof(Alice.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            aborted: true,
            exitCode: error_unregistered_storage_provider,
            success: false
        });

        // Day 0: Alice registers as a worker
        // Alice Timeline: 
        //       Genesis Time (Joined)
        const genesisTime = Math.floor(Date.now() / 1000);
        blockchain.now = genesisTime;
        console.log(`Hour 0: Alice registers as a storage provider`);
        trans = await storageContract.sendRegisterAsStorageProvider(Alice.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_register_as_storage_provider,
            success: true
        });
        expect(await storageContract.getStarted()).toEqual(true);
        expectBigNumberEquals(await storageContract.getPeriodFinish(), BigInt(genesisTime) + newStoragePeriodInSec);
        expect(await storageContract.getTotalStorageProviders()).toEqual(1n);

        // Total rewards: 0.1 $TON per day
        // Alice Timeline: 
        //       Genesis Time (Joined)
        //       + 1 hour (Submit valid report => 1 hour rewards => claimed) 
        let totalRewardsPerHour = totalStorageFee / 180n / 24n / 2n;
        console.log("totalRewardsPerHour: ", totalRewardsPerHour);
        console.log(`Hour 1: Alice submits a valid report`);
        blockchain.now += ONE_HOUR_IN_SECS - 1;
        let nextproof = await storageContract.getNextProof(Alice.address);
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        console.info('proofs:', proofs)
        trans = await storageContract.sendSubmitStorageProof(Alice.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        // console.log(await storageContract.getEarned(Alice.address), totalRewardsPerHour);
        console.log(`Hour 1: Alice claims rewards`);
        expectBigNumberEquals(await storageContract.getEarned(Alice.address), totalRewardsPerHour);
        trans = await storageContract.sendClaimStorageRewards(Alice.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_claim_storage_rewards,
            success: true
        });

        // After 1.5 hour, Alice submit another valid report. And earns nothing
        // Alice Timeline: 
        //       Genesis Time (Joined)
        //       + 1 hour (Submit valid report => 1 hour rewards) 
        //       + 1.5 hour (Submit valid report => ignored due to timeout => 1.5 hours rewards undistributed )
        console.log(`Hour 2.5: Alice submits a valid report. Should be ignored due to timeout`);
        blockchain.now += ONE_HOUR_IN_SECS * 3 / 2;
        nextproof = await storageContract.getNextProof(Alice.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Alice.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getEarned(Alice.address)).toEqual(0n);
        // console.log(await storageContract.getUndistributedRewards(), totalRewardsPerHour * 3n / 2n);
        expectBigNumberEquals(await storageContract.getUndistributedRewards(), totalRewardsPerHour * 3n / 2n);

        // After 0.5 hour, Alice submit another valid report, should earn 0.5 hour rewards
        // Alice Timeline: 
        //       Genesis Time (Joined)
        //       + 1 hour (Submit valid report => 1 hour rewards) 
        //       + 1.5 hour (Submit valid report => ignored due to timeout => 1.5 hours rewards undistributed )
        //       + 0.5 hour (Submit valid report => 0.5 hours rewards)
        console.log(`Hour 3.0: Alice submits a valid report, should earn 0.5 hour rewards`);
        blockchain.now += ONE_HOUR_IN_SECS / 2 - 1;
        let lastTime = blockchain.now;
        nextproof = await storageContract.getNextProof(Alice.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Alice.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Alice.address)).not.toBeFalsy();
        expectBigNumberEquals(await storageContract.getEarned(Alice.address), totalRewardsPerHour / 2n);

        // Bob register as a storage provider
        // Bob Timeline: 
        //       Genesis Time
        //       + 1 hour
        //       + 1.5 hour
        //       + 0.5 hour (Joined)
        console.log(`Hour 3.0: Bob registers as a storage provider`);
        trans = await storageContract.sendRegisterAsStorageProvider(Bob.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: storageContract.address,
            op: op_register_as_storage_provider,
            success: true
        });
        expect(await storageContract.getTotalStorageProviders()).toEqual(2n);

        // 0.5 hour later, Alice submit an invlid report, which should be ignored
        // Alice Timeline: 
        //       Genesis Time (Joined)
        //       + 1 hour (Submit valid report => 1 hour rewards) 
        //       + 1.5 hour (Submit valid report => ignored due to timeout => 1.5 hours rewards undistributed )
        //       + 0.5 hour (Submit valid report => 0.5 hours rewards)
        //       + 0.5 hour (Submit invalid report => ignored)
        console.log(`Hour 3.5: Alice submits a valid report`);
        blockchain.now += ONE_HOUR_IN_SECS / 2;
        nextproof = await storageContract.getNextProof(Alice.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Alice.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Alice.address)).toBeTruthy();

        // 0.5 hour later, both Alice and Bob submit valid reports
        // Alice Timeline: 
        //       Genesis Time (Joined)
        //       + 1 hour (Submit valid report => 1 hour rewards) 
        //       + 1.5 hour (Submit valid report => ignored due to timeout => 1.5 hours rewards undistributed )
        //       + 0.5 hour (Submit valid report => 0.5 hours rewards)
        //       + 0.5 hour (Submit invalid report => ignored)
        //       + 0.5 hour (Submit valid report => another 1 hours rewards / 2)
        // Bob Timeline: 
        //       Genesis Time
        //       + 1 hour
        //       + 1.5 hour
        //       + 0.5 hour (Joined)
        //       + 0.5 hour
        //       + 0.5 hour (Submit valid report => 1 hours rewards / 2)
        console.log(`Hour 4.0: Alice and Bob submit valid reports`);
        blockchain.now = lastTime + ONE_HOUR_IN_SECS - 1;
        lastTime = blockchain.now;
        nextproof = await storageContract.getNextProof(Alice.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Alice.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Alice.address)).not.toBeFalsy();
        nextproof = await storageContract.getNextProof(Bob.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Bob.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Bob.address)).not.toBeFalsy();
        expectBigNumberEquals(await storageContract.getEarned(Alice.address), totalRewardsPerHour / 2n + totalRewardsPerHour / 2n);
        expectBigNumberEquals(await storageContract.getEarned(Bob.address), totalRewardsPerHour / 2n);

        // Caro joins the pool
        console.log(`Hour 4.0: Caro registers as a storage provider`);
        trans = await storageContract.sendRegisterAsStorageProvider(Caro.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: storageContract.address,
            op: op_register_as_storage_provider,
            success: true
        });
        expect(await storageContract.getTotalStorageProviders()).toEqual(3n);

        // Eva could not join
        trans = await storageContract.sendRegisterAsStorageProvider(Eva.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Eva.address,
            to: storageContract.address,
            aborted: true,
            exitCode: error_max_storage_providers_per_order_exceeded,
            success: false
        });

        // 1 hour later (within), Alice, Bob, Caro, all submit valid reports. They share the rewards
        // Alice Timeline: 
        //       Genesis Time (Joined)
        //       + 1 hour (Submit valid report => 1 hour rewards) 
        //       + 1.5 hour (Submit valid report => ignored due to timeout => 1.5 hours rewards undistributed )
        //       + 0.5 hour (Submit valid report => 0.5 hours rewards)
        //       + 0.5 hour (Submit invalid report => ignored)
        //       + 0.5 hour (Submit valid report => another 1 hours rewards / 2)
        //       + 1 hour (Submit valid report => 1 hours rewards / 3)
        // Bob Timeline: 
        //       Genesis Time
        //       + 1 hour
        //       + 1.5 hour
        //       + 0.5 hour (Joined)
        //       + 0.5 hour
        //       + 0.5 hour (Submit valid report => 1 hours rewards / 2)
        //       + 1 hour (Submit valid report => 1 hours rewards / 3)
        // Caro Timeline:
        //       Genesis Time
        //       + 1 hour
        //       + 1.5 hour
        //       + 0.5 hour 
        //       + 0.5 hour
        //       + 0.5 hour (Joined)
        //       + 1 hour (Submit valid report => 1 hours rewards / 3)
        blockchain.now = lastTime + ONE_HOUR_IN_SECS - 1;
        nextproof = await storageContract.getNextProof(Alice.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Alice.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Alice.address)).not.toBeFalsy();
        nextproof = await storageContract.getNextProof(Bob.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Bob.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Bob.address)).not.toBeFalsy();
        nextproof = await storageContract.getNextProof(Caro.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Caro.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Caro.address)).not.toBeFalsy();
        expectBigNumberEquals(await storageContract.getEarned(Alice.address), totalRewardsPerHour / 2n + totalRewardsPerHour / 2n + totalRewardsPerHour / 3n);
        expectBigNumberEquals(await storageContract.getEarned(Bob.address), totalRewardsPerHour / 2n + totalRewardsPerHour / 3n);
        expectBigNumberEquals(await storageContract.getEarned(Caro.address), totalRewardsPerHour / 3n);

        // Alice exits the pool, and still could claim his rewards
        trans = await storageContract.sendUnregisterAsStorageProvider(Alice.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_unregister_as_storage_provider,
            success: true
        });
        expect(await storageContract.getTotalStorageProviders()).toEqual(2n);
        const aliceExactRewards = await storageContract.getEarned(Alice.address);
        expectBigNumberEquals(aliceExactRewards, totalRewardsPerHour / 2n + totalRewardsPerHour / 2n + totalRewardsPerHour / 3n);
        trans = await storageContract.sendClaimStorageRewards(Alice.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            op: op_claim_storage_rewards,
            success: true
        });

        // 1 hour later (within), Bob and Caro submit valid reports, and share the rewards
        // Alice Timeline: 
        //       Genesis Time (Joined)
        //       + 1 hour (Submit valid report => 1 hour rewards) 
        //       + 1.5 hour (Submit valid report => ignored due to timeout => 1.5 hours rewards undistributed )
        //       + 0.5 hour (Submit valid report => 0.5 hours rewards)
        //       + 0.5 hour (Submit invalid report => ignored)
        //       + 0.5 hour (Submit valid report => another 1 hours rewards / 2)
        //       + 1 hour (Submit valid report => 1 hours rewards / 3)  && (Exit)
        // Bob Timeline: 
        //       Genesis Time
        //       + 1 hour
        //       + 1.5 hour
        //       + 0.5 hour (Joined)
        //       + 0.5 hour
        //       + 0.5 hour (Submit valid report => 1 hours rewards / 2)
        //       + 1 hour (Submit valid report => 1 hours rewards / 3)
        //       + 1 hour (Submit valid report => 1 hours rewards / 2)
        // Caro Timeline:
        //       Genesis Time
        //       + 1 hour
        //       + 1.5 hour
        //       + 0.5 hour 
        //       + 0.5 hour
        //       + 0.5 hour (Joined)
        //       + 1 hour (Submit valid report => 1 hours rewards / 3)
        //       + 1 hour (Submit valid report => 1 hours rewards / 2)
        expectBigNumberEquals(await storageContract.getEarned(Bob.address), totalRewardsPerHour / 2n + totalRewardsPerHour / 3n);
        expectBigNumberEquals(await storageContract.getEarned(Caro.address), totalRewardsPerHour / 3n);
        blockchain.now = lastTime + ONE_HOUR_IN_SECS * 2 - 1;
        nextproof = await storageContract.getNextProof(Alice.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Alice.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            aborted: true,
            exitCode: error_unregistered_storage_provider,
            success: false
        });
        nextproof = await storageContract.getNextProof(Bob.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Bob.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Bob.address)).not.toBeFalsy();
        nextproof = await storageContract.getNextProof(Caro.address)
        proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        trans = await storageContract.sendSubmitStorageProof(Caro.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Caro.address)).not.toBeFalsy();
        expectBigNumberEquals(await storageContract.getEarned(Bob.address), totalRewardsPerHour / 2n + totalRewardsPerHour / 3n + totalRewardsPerHour / 2n);
        expectBigNumberEquals(await storageContract.getEarned(Caro.address), totalRewardsPerHour / 3n + totalRewardsPerHour / 2n);

        // 1 hour later (within), Bob leaves the pool, and Caro submits a valid report. Caro gets all the rewards
        // Bob Timeline: 
        //       Genesis Time
        //       + 1 hour
        //       + 1.5 hour
        //       + 0.5 hour (Joined)
        //       + 0.5 hour
        //       + 0.5 hour (Submit valid report => 1 hours rewards / 2)
        //       + 1 hour (Submit valid report => 1 hours rewards / 3)
        //       + 1 hour (Submit valid report => 1 hours rewards / 2)
        //       + 1 hour (Exit => 1 hours rewards / 2 to undistributed)
        // Caro Timeline:
        //       Genesis Time
        //       + 1 hour
        //       + 1.5 hour
        //       + 0.5 hour 
        //       + 0.5 hour
        //       + 0.5 hour (Joined)
        //       + 1 hour (Submit valid report => 1 hours rewards / 3)
        //       + 1 hour (Submit valid report => 1 hours rewards / 2)
        //       + 1 hour (Submit valid report => 1 hours rewards / 2)
        // console.log("######################");
        let undistributedRewards = await storageContract.getUndistributedRewards();
        blockchain.now = lastTime + ONE_HOUR_IN_SECS * 3 - 1;
        trans = await storageContract.sendUnregisterAsStorageProvider(Bob.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Bob.address,
            to: storageContract.address,
            op: op_unregister_as_storage_provider,
            success: true
        });
        expect(await storageContract.getTotalStorageProviders()).toEqual(1n);
        // nextproof = await storageContract.getNextProof(Caro.address)
        // proofs = await mt.getDataAndProofs(file, parseInt((nextproof/BigInt(mt.opt.chunkSize)).toString()));
        // Note: Caro is on the white list, so any proofs she submits is considerred valid
        proofs = [];
        trans = await storageContract.sendSubmitStorageProof(Caro.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Caro.address)).not.toBeFalsy();
        expectBigNumberEquals(await storageContract.getEarned(Caro.address), totalRewardsPerHour / 3n + totalRewardsPerHour / 2n + totalRewardsPerHour / 2n);
        expectBigNumberEquals(await storageContract.getUndistributedRewards(), undistributedRewards + totalRewardsPerHour / 2n);

        let exactRewardsOfCaro = await storageContract.getEarned(Caro.address);
        undistributedRewards = await storageContract.getUndistributedRewards();

        // Eva now could join
        trans = await storageContract.sendRegisterAsStorageProvider(Eva.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Eva.address,
            to: storageContract.address,
            op: op_register_as_storage_provider,
            success: true
        });
        expect(await storageContract.getTotalStorageProviders()).toEqual(2n);

        // 3 hours later, Eva sumits any report, and gets (totalRewardsPerHour / 2n * 3) rewards. Since he is on the white list.
        blockchain.now = lastTime + ONE_HOUR_IN_SECS * 6 - 1;
        proofs = [];
        trans = await storageContract.sendSubmitStorageProof(Eva.getSender(), proofs);
        expect(trans.transactions).toHaveTransaction({
            from: Eva.address,
            to: storageContract.address,
            op: op_submit_storage_proof,
            success: true
        });
        expect(await storageContract.getLastProofValid(Eva.address)).not.toBeFalsy();
        expectBigNumberEquals(await storageContract.getEarned(Eva.address), totalRewardsPerHour / 2n * 3n);

        // Fast forward to the end
        blockchain.now = await Number(await storageContract.getPeriodFinish()) + 1;
        // Caro's total rewards should remain unchanged, since she does not submit valid report
        expectBigNumberEquals(await storageContract.getEarned(Caro.address), exactRewardsOfCaro);

        // Now Dave could recylce the undistributed rewards
        trans = await storageContract.sendRecycleUndistributedStorageFees(Alice.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Alice.address,
            to: storageContract.address,
            aborted: true,
            exitCode: error_unauthorized,
            success: false
        });
        trans = await storageContract.sendRecycleUndistributedStorageFees(Dave.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Dave.address,
            to: storageContract.address,
            op: op_recycle_undistributed_storage_fees,
            success: true
        });

        // Now Caro exits the pool, her un-settled rewards should be tracked as undistributed rewards
        trans = await storageContract.sendUnregisterAsStorageProvider(Caro.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: storageContract.address,
            op: op_unregister_as_storage_provider,
            success: true
        });
        console.log(`Before claim rewards. Contract balance: ${fromNano(await storageContract.getBalance())}, Caro balance: ${fromNano(await Caro.getBalance())}, Caro rewards: ${fromNano(await storageContract.getEarned(Caro.address))}`);
        trans = await storageContract.sendClaimStorageRewards(Caro.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Caro.address,
            to: storageContract.address,
            op: op_claim_storage_rewards,
            success: true
        });
        console.log(`After claim rewards. Contract balance: ${fromNano(await storageContract.getBalance())}, Caro balance: ${fromNano(await Caro.getBalance())}, Caro rewards: ${fromNano(await storageContract.getEarned(Caro.address))}`);

        const poolBalance = await storageContract.getBalance();
        undistributedRewards = await storageContract.getUndistributedRewards();
        console.log(fromNano(poolBalance), fromNano(undistributedRewards));
        // expectBigNumberEquals(poolBalance, undistributedRewards);

        console.log(`Before claim undistributed rewards. Contract balance: ${fromNano(await storageContract.getBalance())}, Dave balance: ${fromNano(await Dave.getBalance())}, Undistributed rewards: ${fromNano(await storageContract.getUndistributedRewards())}`);
        trans = await storageContract.sendRecycleUndistributedStorageFees(Dave.getSender());
        expect(trans.transactions).toHaveTransaction({
            from: Dave.address,
            to: storageContract.address,
            op: op_recycle_undistributed_storage_fees,
            success: true
        });
        console.log(`After claim undistributed rewards. Contract balance: ${fromNano(await storageContract.getBalance())}, Dave balance: ${fromNano(await Dave.getBalance())}, Undistributed rewards: ${fromNano(await storageContract.getUndistributedRewards())}`);
        console.log(`Treasury account balance: ${fromNano(await Treasury.getBalance())}`);

    });


});
