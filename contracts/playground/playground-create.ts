// deno run -A ./contracts/playground/playground-create.ts
// deno-lint-ignore-file

import { Blockfrost, Lucid } from "lucid-cardano";
import { mkLucidWallet } from "@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import "$std/dotenv/load.ts";
import { mkContract } from "./playground-implementation.ts";
import { VestingRequest } from "./playground-implementation.ts";
import {
  addressBech32,  
  stakeAddressBech32,  
} from "@marlowe.io/runtime-core";

import { VestingScheme } from "@/contracts/playground/playground-implementation.ts";


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

//set TAG
const tag = "vesting-contract1";

//set amount
const amount = 10n;

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

//setting the parameters
const startTimeout = new Date(Date.now() + 1 * 60 * 60 * 1000);

const requestScheme: VestingScheme = {
  startTimeout: startTimeout,
  amount: amount * 1000000n,
};

const request: VestingRequest = {
  provider: { "address": address },
  claimer: {
    "address": claimer,
  },
  scheme: requestScheme,
};

//deploy smart contract
const vestingContract = mkContract(request);
const [contractId, txIdCreated] = await lifecycle.contracts.createContract({
  contract: vestingContract,
  tags: {
    [tag]: {
      title: "Vesting Contract",
      firstName: "John",
      lastName: "Doe",
      providerId: address.slice(0,18),
      claimerId: claimer.slice(0,18),
      scheme: request.scheme
    },
  },
});

console.log("Contract ID: ", contractId);
console.log("Transaction ID: ", txIdCreated);