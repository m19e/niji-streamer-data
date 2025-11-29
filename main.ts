import { getShiorihaDemo } from "/mods/getStreamer.ts";

const checkShouldUpdate = (arr1: any[], arr2: any[]) => {
  return arr1.length !== arr2.length;
};

const main = async () => {
  await getShiorihaDemo();
};

main();
