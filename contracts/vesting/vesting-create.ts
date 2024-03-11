// deno run -A ./contracts/vesting/vesting-create.ts
// deno-lint-ignore-file

import { Blockfrost, Lucid } from "lucid-cardano";
import { mkLucidWallet } from "@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import "$std/dotenv/load.ts";
import { addressBech32, stakeAddressBech32 } from "@marlowe.io/runtime-core";
import { VestingRequest } from "@/contracts/vesting/vesting-implementation.ts";
import { mkContract } from "@/contracts/vesting/vesting-implementation.ts";
import { Address, lovelace } from "npm:@marlowe.io/language-core-v1";

const projectId = Deno.env.get("PROJECTID");

//Eternl and Nami wallet
// const seedPhrase = Deno.env.get("SEEDPHRASE");
//Eternl and Lace wallet
const seedPhrase = Deno.env.get("SEEDPHRASELACE");

//Eternl and Nami wallet
const claimer = addressBech32(
  "addr_test1qzscf4np7r463twwrhxfnz4t0ce5vt07wq39v92erjwq0s6wladqsndw3y6r3t5ra7ecys6uplm0glyx24kvfm9t5x8sxt497z",
);
//Eternl and Lace wallet
// const claimer = addressBech32(
//   "addr_test1qqp0gher3aeyvvvntx68xc85dkz98nlk2tqv6eqc07we2tgcrxu378rj6ztjmftl0dlz2ahtq63gl5my7sz6stt0p36q3rzswz",
// );

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
// @ts-ignore
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

//set TAG
const dAppId = "vesting-contract";

const firstName: string = "Erick";
const lastName: string = "Romero";
const title: string = "Vesting Contract";
const request: VestingRequest = {
  provider: { address: address },
  claimer: { address: claimer },
  scheme: {
    start: new Date("2024-03-11T22:11:00.000Z"),
    frequency: "by-10-minutes",
    numberOfPeriods: 3n,
    expectedInitialDeposit: { token: lovelace, amount: 6n * 1_000_000n },
  },
};

const vestingContract = mkContract(request);
const claimerAddress = request.claimer as Address;
const providerAddress = request.provider as Address;
const [contractId, txIdCreated] = await lifecycle?.contracts
  .createContract({
    contract: vestingContract,
    tags: {
      [dAppId]: {
        title: title,
        firstName: firstName,
        lastName: lastName,
        providerId: providerAddress.address.slice(0, 18),
        claimerId: claimerAddress.address.slice(0, 18),
        scheme: request.scheme,
      },
    },
  });

console.log("Contract ID: ", contractId);
console.log("Transaction ID: ", txIdCreated);
