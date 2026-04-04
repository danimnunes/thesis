import { task } from "hardhat/config";

import { HDNodeWallet, Mnemonic } from "ethers";

// "m/44'/60'/0'/0/0" first account
const getPathForIndex = (index: number) => `m/44'/60'/0'/0/${index}`;

// follows ETH/BTC's BIP 39 protocol
// https://iancoleman.io/bip39/
// and matches the one hardhat uses when using { accounts: { mnemonic }}
task("accountsFromMnemonic", "prints the first few accounts of a mnemonic")
  .addParam(
    "mnemonic",
    "The mnemonic used for BIP39 key derivation: See https://iancoleman.io/bip39",
  )
  .setAction(async (taskArgs: { mnemonic: string }) => {
    const { mnemonic } = taskArgs;

    if (!mnemonic) {
      throw new Error(`Missing task argument --mnemonic `);
    }

    const masterKey = await Promise.resolve(
      HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic)),
    );

    for (const [index, _] of Array.from({ length: 5 }).entries()) {
      const key = masterKey.derivePath(getPathForIndex(index));
      console.log(
        `Key ${getPathForIndex(index)}: ${key.address} (PK: ${
          key.publicKey
        }) (sk: ${key.privateKey})`,
      );
    }
  });
