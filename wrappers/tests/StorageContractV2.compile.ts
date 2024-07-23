import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'func',
    targets: ['tests/contracts/storage-contract-v2.fc'],
};
