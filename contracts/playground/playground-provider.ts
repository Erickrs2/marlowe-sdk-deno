// deno run -A ./contracts/playground/playground-provider.ts
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
  contractId,
  stakeAddressBech32,
  Tags,
} from "@marlowe.io/runtime-core";
import { Input } from "@marlowe.io/language-core-v1";
import { getVestingState } from "@/contracts/playground/playground-implementation.ts";
import { Contract } from "@/contracts/playground/type.ts";
import { VestingState } from "@/contracts/playground/playground-implementation.ts";
import { WaitingDepositByProvider } from "@/contracts/playground/playground-implementation.ts";
import { NoDepositBeforeDeadline } from "@/contracts/playground/playground-implementation.ts";
import {
  VestingEnded,
  WithinVestingPeriod,
} from "@/contracts/playground/playground-implementation.ts";
import {
  Closed,
  UnknownState,
} from "@/contracts/playground/playground-implementation.ts";

type UserIntention = "Deposit" | "Cancel" | undefined;
const userIntention = "Deposit";

const projectId = Deno.env.get("PROJECTID");

//Eternl and Lace wallet
const seedPhrase = Deno.env.get("SEEDPHRASELACE");

//set TAG
const tag = "vesting-contract7";

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

const allContracts: Contract<VestingState>[] = await Promise.all(
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
    ).then((
      state,
    ) => ({
      contractId: contractId,
      providerId: tags[tag].providerId,
      title: tags[tag].title ? tags[tag].title : "",
      claimer: {
        firstName: tags[tag].firstName,
        lastName: tags[tag].lastName,
        id: tags[tag].claimerId,
      },
      state: state,
    } as Contract<VestingState>))
  ),
);

const contractsWithinVestingPeriod = allContracts
  .filter((c) => c.state?.name === "WithinVestingPeriod")
  .map((c) => c as Contract<WithinVestingPeriod>);

const contractsWaitingForDeposit = allContracts
  .filter((c) => c.state?.name === "WaitingDepositByProvider")
  .map((c) => c as Contract<WaitingDepositByProvider>);

const contractsNoDepositBeforeDeadline = allContracts
  .filter((c) => c.state?.name === "NoDepositBeforeDeadline")
  .map((c) => c as Contract<NoDepositBeforeDeadline>);

const contractsVestingEnded = allContracts
  .filter((c) => c.state?.name === "VestingEnded")
  .map((c) => c as Contract<VestingEnded>);

const contractsClosed = allContracts
  .filter((c) => c.state?.name === "Closed")
  .map((c) => c as Contract<Closed>);

const unknownContracts = allContracts
  .filter((c) => c.state?.name === "UnknownState")
  .map((c) => c as Contract<UnknownState>);

console.log("ContractsWithinVestingPeriod", contractsWithinVestingPeriod);
console.log(
  "ContractsNoDepositBeforeDeadline",
  contractsNoDepositBeforeDeadline,
);
console.log("ContractsVestingEnded", contractsVestingEnded);
console.log("contractsClosed", contractsClosed);
console.log("ContractsWaitingForDeposit", contractsWaitingForDeposit);
console.log("UnknownContracts", unknownContracts);

if (userIntention === "Deposit" && contractsWaitingForDeposit.length > 0) {
  const txId = await lifecycle.contracts.applyInputs(
    // @ts-ignore
    contractsWaitingForDeposit[0].contractId,
    { inputs: contractsWaitingForDeposit[0].state.depositInput },
  );
  console.log("txId", txId);
}

if (userIntention === "Cancel" && contractsWithinVestingPeriod.length > 0) {
  const txId = await lifecycle.contracts.applyInputs(
    // @ts-ignore
    contractsWithinVestingPeriod[0].contractId,
    { inputs: contractsWithinVestingPeriod[0].state.cancelInput },
  );
  console.log("txId", txId);
}
