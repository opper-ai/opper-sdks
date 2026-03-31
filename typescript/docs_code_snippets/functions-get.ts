import { Opper } from "opperai";

const opper = new Opper();

const fn = await opper.functions.get("my-function");
console.log(`Name: ${fn.name}`);
console.log(`Schema hash: ${fn.schema_hash}`);
console.log(`Hit count: ${fn.hit_count}`);
