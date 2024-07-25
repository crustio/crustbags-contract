import { NetworkProvider } from "@ton/blueprint";
import { Address, toNano } from "@ton/core";
import { TonBags } from "../wrappers/TonBags";
import { getMerkleRoot } from "../tests/merkleProofUtils";
import { default_storage_period } from "../wrappers/constants";

export async function run(provider: NetworkProvider) {
    const tonBags = provider.api().open(TonBags.createFromAddress(Address.parse("EQBOOMNqG0rvNm6vFGfR4qZl48BTDw_gYefVI4DQ70t9GoPC")));
    // TODO: send order to TonBags
    const sender = provider.sender();
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
    await tonBags.sendPlaceStorageOrder(sender, torrentHash, fileSize, merkleRoot, toNano('0.1'), default_storage_period);
}