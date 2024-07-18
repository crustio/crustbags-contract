import { beginCell, Builder } from '@ton/core';
import { sha256 } from 'js-sha256';

export function proofsIntoBody(body: Builder, datas: bigint[]) {
    const chunks: bigint[][] = [[]];
    const chunkcount = 3;
    datas.forEach((data) => {
        let last = chunks[chunks.length - 1];
        if (last.length == chunkcount) {
            chunks.push([]);
        }
        last = chunks[chunks.length - 1];
        last.push(data);
    });
    // console.info('datas:', chunks);
    const cbs = chunks.map((chunk) => {
        const cell = beginCell();
        cell.storeUint(chunk.length, 16);
        chunk.forEach((data) => cell.storeUint(data, 256));
        return cell;
    });
    //
    if (cbs.length <= 4) {
        cbs.forEach((cb) => body.storeRef(cb));
    } else if (cbs.length <= 20) {
        let ncbs = cbs.slice(0);
        while (ncbs.length) {
            console.info('ncbs:', ncbs.length);
            const p = ncbs[0];
            ncbs.slice(1, 5).forEach((cb) => p.storeRef(cb));
            body.storeRef(p);
            ncbs = ncbs.slice(5);
        }
    }
}

export function hash(value: bigint) {
    return BigInt('0x' + beginCell().storeUint(value, 256).endCell().hash(0).toString('hex'));
}

export function abToBn(data: ArrayBuffer) {
    return BigInt('0x' + Buffer.from(data).toString('hex'));
}

export function abHash(data: ArrayBuffer) {
    return hash(abToBn(data));
}

export function hashs(a: bigint, b: bigint) {
    return hash(a ^ b);
}

export type ProofTreeNode = {
    value: bigint;
    left?: ProofTreeNode;
    right?: ProofTreeNode;
};

export const CHUNK_SIZE = 256;

const hasRemaining = async () => {
    if (typeof requestIdleCallback == 'undefined') return;
    while (true) {
        const has = await new Promise<boolean>((resolve) => {
            requestIdleCallback((t) => {
                resolve(t.timeRemaining() > 1);
            });
        });
        if (has) return;
    }
};

const readAsBn = async (file: File | Blob, start: number, end: number) => {
    if (start >= file.size) return 0n;
    const ab = await file.slice(start, end).arrayBuffer();
    const bn = BigInt('0x' + sha256(ab));
    return bn;
};

export function calcChunkSize(filesize: bigint | number) {
    const size = typeof filesize !== 'bigint' ? BigInt(filesize) : filesize;
    const count = 128n;
    const chunk = size % count == 0n ? size / count : size / count + 1n;
    return chunk >= 64n ? chunk : 64n;
}

export async function genProofsTree(file: File | Blob) {
    const chunkSize = parseInt(calcChunkSize(file.size).toString());
    const nodes: bigint[] = new Array(Math.ceil(file.size / chunkSize));
    let offset = 0;
    let index = 0;
    while (true) {
        await hasRemaining();
        const value = await readAsBn(file, offset, offset + chunkSize);
        nodes[index] = hash(value ^ BigInt(index));
        index += 1;
        offset = offset + chunkSize;
        if (offset >= file.size) {
            break;
        }
    }
    const tree: bigint[] = new Array(2 * nodes.length - 1);
    for (let i = 0; i < nodes.length; i++) {
        tree[tree.length - 1 - i] = nodes[i];
    }
    for (let i = tree.length - 1 - nodes.length; i >= 0; i--) {
        tree[i] = hashs(tree[2 * i + 1]!, tree[2 * i + 2]!);
    }
    return tree;
}

export async function getProofs(file: File | Blob, tree: bigint[], i: number) {
    const chunkSize = parseInt(calcChunkSize(file.size).toString());
    // console.info('tree', tree.length, tree[0]);
    const offset = i * chunkSize;
    const data = await readAsBn(file, offset, offset + chunkSize);
    i = tree.length - 1 - i; // tree index
    const proof: bigint[] = [];
    while (i > 0) {
        proof.push(tree[i - (-1) ** (i % 2)]);
        i = Math.floor((i - 1) / 2);
    }
    return [data, ...proof];
}
