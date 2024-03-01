// deno run -A ./contracts/playground/playground-run.ts
// deno-lint-ignore-file

import { Blockfrost, Lucid } from "lucid-cardano";
import { mkLucidWallet } from "@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import { stakeAddressBech32 } from "@marlowe.io/runtime-core";

import "$std/dotenv/load.ts";
import { mkContract } from "@/contracts/playground/playground-template.ts";
import { VestingRequest } from "@/contracts/playground/playground-template.ts";
import { AddressBech32, ContractId, Tags, addressBech32 } from '@marlowe.io/runtime-core';
const projectId = Deno.env.get("PROJECTID");
const seedPhrase = Deno.env.get("SEEDPHRASE");

//initialize the runtime
const runtimeURL =
  "https://marlowe-runtime-preprod-web.demo.scdev.aws.iohkdev.io";
const restAPI = mkRestClient(runtimeURL);

//initialize lucid and lifecycle
const lucid = await Lucid.new(
  new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", projectId),
  "Preprod",
);
lucid.selectWalletFromSeed(seedPhrase!);
const wallet = mkLucidWallet(lucid);
const lifecycle = mkRuntimeLifecycle({
  runtimeURL,
  wallet,
});

//get reward address and used address
const rewardAddressStr = await lucid.wallet.rewardAddress();
const rewardAddress = rewardAddressStr
  ? stakeAddressBech32(rewardAddressStr)
  : undefined;
const addresses = await lifecycle.wallet.getUsedAddresses();
const address = addresses[0];

/** 
//setting the vesting Request
let now = new Date();
now.setTime(now.getTime() + (10 * 60 * 1000));

const request: VestingRequest = {
  provider: { "address": address },
  claimer: {
    "address":
      "addr_test1qq743xta8l29euutaxunwvtpl53vmzp0f87qzunhhk0d00stqyfn0gq3sxzd0kra8ruud6qa8v8jtx6sjv3x04g7yc2s8rcqkn",
  },
  startTimeout: now,
  amount: 10n * 1000000n,
};

//deploy smart contract
const vestingContract = mkContract(request);
const [contractId, txIdCreated] = await lifecycle.contracts.createContract({
  contract: vestingContract,
  tags: {
  vestingContract: "criando um contrato de vesting", 
  }
});

console.log("Contract ID: ", contractId);
console.log("Transaction ID: ", txIdCreated);
*/

const result = await restAPI.getContracts({partyAddresses: addresses, tags: ["vestingContract"]});
console.log(result)