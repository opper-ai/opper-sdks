import { Opper } from "opperai";

const opper = new Opper();

const functions = await opper.functions.list();
for (const fn of functions.slice(0, 5)) {
  console.log(`${fn.name} (hits: ${fn.hit_count})`);
}
