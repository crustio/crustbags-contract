import { ethers } from "ethers";

/**
 * Ref: 
 * https://ethereum.org/en/developers/tutorials/merkle-proofs-for-offline-data-integrity
 * https://github.com/qbzzt/merkle-proofs-for-offline-data-integrity
 */

// Convert between the string the hash function expects and the
// BigInt we use everywhere else.
const hash = (x: bigint) => BigInt(
  ethers.keccak256(('0x' + x.toString(16).padStart(64, '0'))))


// Symetrical hash of a pair so we won't care if the order is reversed.
const pairHash = (a: bigint, b: bigint) => hash(hash(a) ^ hash(b))

// The value to denote that a certain branch is empty, doesn't
// have a value
const empty = 0n


// Calculate one level up the tree of a hash array by taking the hash of 
// each pair in sequence
export const oneLevelUp = (inputArray: bigint[]) => {
    var result = []
    var inp = [...inputArray]    // To avoid over writing the input

    // Add an empty value if necessary (we need all the leaves to be
    // paired)
    if (inp.length % 2 === 1)
        inp.push(empty)

    for(var i=0; i<inp.length; i+=2)
        result.push(pairHash(inp[i],inp[i+1]))

    return result
}    // oneLevelUp


// Get the merkle root of a hashArray
export const getMerkleRoot = (inputArray: bigint[]) => {
    var result

    result = [...inputArray]

    // Climb up the tree until there is only one value, that is the
    // root. 
    //
    // Note that if a layer has an odd number of entries the
    // code in oneLevelUp adds an empty value, so if we have, for example,
    // 10 leaves we'll have 5 branches in the second layer, 3
    // branches in the third, 2 in the fourth and the root is the fifth       
    while(result.length > 1)
        result = oneLevelUp(result)

    return result[0]
}


// A merkle proof consists of the value of the list of entries to 
// hash with. Because we use a symmetrical hash function, we don't
// need the item's location to verify, only to create the proof.
export const getMerkleProof = (inputArray: bigint[], n: number) => {
    var result = [], currentLayer = [...inputArray], currentN = n

    // Until we reach the top
    while (currentLayer.length > 1) {
        // No odd length layers
        if (currentLayer.length % 2)
            currentLayer.push(empty)

        result.push(currentN % 2    
               // If currentN is odd, add the value before it
            ? currentLayer[currentN-1] 
               // If it is even, add the value after it
            : currentLayer[currentN+1])

        // Move to the next layer up
        currentN = Math.floor(currentN/2)
        currentLayer = oneLevelUp(currentLayer)
    }   // while currentLayer.length > 1

    return result
}   // getMerkleProof