// export PROJECTID=xxxxxx
// export SEEDPHRASE="your seed phrase"
// deno run -A ./contracts/playground/playground-run.ts

import { Lucid, Blockfrost } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { mkLucidWallet } from "npm:@marlowe.io/wallet";
import { mkRuntimeLifecycle } from "npm:@marlowe.io/runtime-lifecycle";
import { mkRestClient } from "npm:@marlowe.io/runtime-rest-client";

const runtimeURL =
  "https://marlowe-runtime-preprod-web.demo.scdev.aws.iohkdev.io";

const projectId = Deno.env.get("PROJECTID");
const seedPhrase = Deno.env.get("SEEDPHRASE");
console.log(projectId, seedPhrase)

const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", projectId),
    "Preprod"
  );
lucid.selectWalletFromSeed(seedPhrase!);
console.log(lucid)

const wallet = mkLucidWallet(lucid);
console.log(wallet)

const lifecycle = mkRuntimeLifecycle({
    runtimeURL,
    wallet,
  });
console.log(lifecycle)

const restAPI = mkRestClient(runtimeURL);
console.log(restAPI)
