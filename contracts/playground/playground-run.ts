import { Lucid, Blockfrost } from "https://deno.land/x/lucid/mod.ts"

const projectId = Deno.env.get("PROJECTID");
console.log(projectId)

/** 
const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", projectId),
    "Preprod"
  );

console.log(lucid)
*/