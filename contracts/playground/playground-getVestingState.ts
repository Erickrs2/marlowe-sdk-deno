// deno run -A ./contracts/playground/playground-getVestingState.ts
// deno-lint-ignore-file

import { Blockfrost, Lucid } from "lucid-cardano";
import { mkLucidWallet } from "@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "@marlowe.io/runtime-rest-client";
import { ContractDetails } from "@marlowe.io/runtime-rest-client/contract/details";
import "$std/dotenv/load.ts";
import {
  addressBech32,
  ContractId,
  stakeAddressBech32,
  Tags,
} from "@marlowe.io/runtime-core";
import { Input } from "@marlowe.io/language-core-v1";
import { getVestingState } from "@/contracts/playground/playground-implementation.ts";

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
const tag = "vesting-contract";

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

// @ts-ignore
//get contracts IDs and Tags
const contractIdsAndTags: [ContractId, Tags][] = (await restAPI.getContracts({
  // @ts-ignore
  partyAddresses: addresses,
  tags: [tag],
}))
  .contracts
  .filter((contract) => contract.tags[tag].providerId === address.slice(0, 18))
  .map((contract) => [contract.contractId, contract.tags]);

//get contract IDs, Tags and Details
const contractIdsAndDetails: [ContractId, Tags, ContractDetails][] =
  await Promise.all(
    contractIdsAndTags.map(([contractId, tags]) =>
      restAPI
        // @ts-ignore
        .getContractById(contractId)
        .then((details) =>
          [contractId, tags, details] as [ContractId, Tags, ContractDetails]
        )
    ),
  ) as [ContractId, Tags, ContractDetails][];

//get contract Ids, Tags and Input History
const contractIdsAndDetailsAndInputHistory = await Promise.all(
  contractIdsAndDetails.map(([contractId, tags, details]) =>
    restAPI
      // @ts-ignore
      .getTransactionsForContract(contractId)
      .then((result) =>
        Promise.all(
          result.transactions.map((txHeader) =>
            restAPI.getContractTransactionById(
              // @ts-ignore
              contractId,
              txHeader.transactionId,
            )
          ),
        )
      )
      .then((txsDetails) =>
        txsDetails.map((txDetails) => txDetails.inputs).flat()
      )
      .then((inputHistory) =>
        [contractId, tags, details, inputHistory] as [
          ContractId,
          Tags,
          ContractDetails,
          Input[],
        ]
      )
  ),
);

const allContracts = await Promise.all(
  contractIdsAndDetailsAndInputHistory.map((
    [contractId, tags, details, inputHistory],
  ) =>
    getVestingState(
      tags[tag].scheme,
      details.state,
      inputHistory,
      (environment) =>
        lifecycle.contracts.getApplicableInputs(
          // @ts-ignore
          contractId,
          environment,
        ),
    ).then((state) => console.log(state))
  ),
);


