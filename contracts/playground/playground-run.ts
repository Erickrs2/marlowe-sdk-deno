// export PROJECTID=xxxxxx
// export SEEDPHRASE="your seed phrase"
// deno run -A ./contracts/playground/playground-run.ts

import { Blockfrost, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { mkLucidWallet } from "npm:@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "npm:@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "npm:@marlowe.io/runtime-rest-client";
import { stakeAddressBech32 } from "@marlowe.io/runtime-core";

const runtimeURL =
  "https://marlowe-runtime-preprod-web.demo.scdev.aws.iohkdev.io";

const projectId = Deno.env.get("PROJECTID");
const seedPhrase = Deno.env.get("SEEDPHRASE");

const lucid = await Lucid.new(
  new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", projectId),
  "Preprod",
);
lucid.selectWalletFromSeed(seedPhrase!);
const rewardAddressStr = await lucid.wallet.rewardAddress();
const rewardAddress = rewardAddressStr
  ? stakeAddressBech32(rewardAddressStr)
  : undefined;

const wallet = mkLucidWallet(lucid);

const lifecycle = mkRuntimeLifecycle({
  runtimeURL,
  wallet,
});
console.log(lifecycle);

const restAPI = mkRestClient(runtimeURL);

const address = await lifecycle.wallet.getChangeAddress();
console.log({rewardAddress, address})
