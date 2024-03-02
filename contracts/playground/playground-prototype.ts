// deno run -A ./contracts/playground/playground-prototype.ts
// deno-lint-ignore-file

import { Blockfrost, Lucid } from "lucid-cardano";
import { mkLucidWallet } from "@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import { ContractDetails } from "@marlowe.io/runtime-rest-client/contract/details";
import "$std/dotenv/load.ts";
import { mkContract } from "./playground-implementation.ts";
import { VestingRequest } from "./playground-implementation.ts";
import {
  addressBech32,
  ContractId,
  stakeAddressBech32,
  Tags,
} from "@marlowe.io/runtime-core";
import { Address, Input } from "@marlowe.io/language-core-v1";
import { VestingScheme } from "@/contracts/playground/playground-implementation.ts";
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

//setting the parameters
let now = new Date();
now.setTime(now.getTime() + (10 * 60 * 1000));

const claimer = addressBech32(
  "addr_test1qq743xta8l29euutaxunwvtpl53vmzp0f87qzunhhk0d00stqyfn0gq3sxzd0kra8ruud6qa8v8jtx6sjv3x04g7yc2s8rcqkn",
);

const requestScheme: VestingScheme = {
  startTimeout: now,
  amount: 10n * 1000000n,
};

const request: VestingRequest = {
  provider: { "address": address },
  claimer: {
    "address": claimer,
  },
  scheme: requestScheme,
};

const tag = "vestingContract";

//deploy smart contract
// const vestingContract = mkContract(request);
// const [contractId, txIdCreated] = await lifecycle.contracts.createContract({
//   contract: vestingContract,
//   tags: {
//     [tag]: {
//       title: "Vesting Contract",
//       firstName: "John",
//       lastName: "Doe",
//       providerId: address.slice(0,18),
//       claimerId: claimer.slice(0,18),
//       scheme: request.scheme
//     },
//   },
// });

// console.log("Contract ID: ", contractId);
// console.log("Transaction ID: ", txIdCreated);

//get contracts IDs and Tags
const contractIdsAndTags: [ContractId, Tags][] = (await restAPI.getContracts({
  partyAddresses: addresses,
  tags: [tag],
}))
  .contracts
  .filter((contract) => contract.tags[tag].providerId === address.slice(0, 18))
  .map((contract) => [contract.contractId, contract.tags]);

// console.log(contractIdsAndTags);

//get contract IDs, Tags and Details
const contractIdsAndDetails: [ContractId, Tags, ContractDetails][] =
  await Promise.all(
    contractIdsAndTags.map(([contractId, tags]) =>
      restAPI
        .getContractById(contractId)
        .then((details) =>
          [contractId, tags, details] as [ContractId, Tags, ContractDetails]
        )
    ),
  );

// console.log(contractIdsAndDetails);

//get contract Ids, Tags and Input History
const contractIdsAndDetailsAndInputHistory = await Promise.all(
  contractIdsAndDetails.map(([contractId, tags, details]) =>
    restAPI
      .getTransactionsForContract(contractId)
      .then((result) => Promise.all(
        result.transactions.map((txHeader) =>
          restAPI.getContractTransactionById(
            contractId,
            txHeader.transactionId
          )
        )))
      .then((txsDetails) =>  txsDetails.map((txDetails) => txDetails.inputs).flat())
      .then((inputHistory) => [contractId, tags, details, inputHistory] as [ContractId,Tags,ContractDetails,Input[]])
));

console.log(contractIdsAndDetailsAndInputHistory);
