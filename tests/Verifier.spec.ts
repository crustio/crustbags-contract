import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Verifier } from '../wrappers/Verifier';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

import * as snarkjs from "snarkjs";
import path from "path";
import { buildBls12381, utils } from "ffjavascript";
const { unstringifyBigInts } = utils;

const wasmPath = path.join(__dirname, "../build/circuits", "circuit.wasm");
const zkeyPath = path.join(__dirname, "../build/circuits", "circuit_final.zkey");

describe('Verifier', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Verifier');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let verifierContract: SandboxContract<Verifier>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        verifierContract = blockchain.openContract(Verifier.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await verifierContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifierContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and tonBags are ready to use
    });

    it('should verify', async () => {
        // proof generation
        let input = {
          "a": "123",
          "b": "456",
        }
        let {proof, publicSignals} = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        let curve = await buildBls12381();
        let proofProc = unstringifyBigInts(proof);
        var pi_aS = g1Compressed(curve, proofProc.pi_a);
        var pi_bS = g2Compressed(curve, proofProc.pi_b);
        var pi_cS = g1Compressed(curve, proofProc.pi_c);
        var pi_a = Buffer.from(pi_aS, "hex");
        var pi_b = Buffer.from(pi_bS, "hex");
        var pi_c = Buffer.from(pi_cS, "hex");
        
        // send the proof to the contract
        const verifier = await blockchain.treasury('verifier');
        const verifyResult = await verifierContract.sendVerify(verifier.getSender(), {
            pi_a: pi_a,
            pi_b: pi_b,
            pi_c: pi_c,
            pubInputs: publicSignals,
            value: toNano('0.15'), // 0.15 TON for fee
        });
        expect(verifyResult.transactions).toHaveTransaction({
            from: verifier.address,
            to: verifierContract.address,
            success: true,
        });

        const res = await verifierContract.getRes();

        expect(res).not.toEqual(0); // check proof result

        return;
    });

    function g1Compressed(curve, p1Raw) {
        let p1 = curve.G1.fromObject(p1Raw);
        
        let buff = new Uint8Array(48);
        curve.G1.toRprCompressed(buff, 0, p1);
        // convert from ffjavascript to blst format
        if (buff[0] & 0x80) {
            buff[0] |= 32;
        }
        buff[0] |= 0x80;
        return toHexString(buff);
    }
      
    function g2Compressed(curve, p2Raw) {
        let p2 = curve.G2.fromObject(p2Raw);
        
        let buff = new Uint8Array(96);
        curve.G2.toRprCompressed(buff, 0, p2);
        // convert from ffjavascript to blst format
        if (buff[0] & 0x80) {
            buff[0] |= 32;
        }
        buff[0] |= 0x80;
        return toHexString(buff);
    }
      
    function toHexString(byteArray) {
        return Array.from(byteArray, function (byte: any) {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join("");
    }

});
