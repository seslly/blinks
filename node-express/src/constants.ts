import { PublicKey } from "@solana/web3.js";
import type { User } from "./types";

export const DEFAULT_SOL_ADDRESS: PublicKey = new PublicKey(
  "C9zuJ4HAacKTCHfk4dhQeoDbAHx4j94gTmyb7ovf8rZy", // mainnet wallet
);

export const DEFAULT_SOL_AMOUNT: number = 0.001;

export const DEFAULT_MSG_SIGN: string = "donation memo: ";

// in memory DB, prob want to use redis in prod
export const db = new Map<string, User>();

// add user to the db
db.set("C9zuJ4HAacKTCHfk4dhQeoDbAHx4j94gTmyb7ovf8rZy", {
  name: "seslly",
  icon: "seslly.png",
  description: "Wedding fund",
  actionTitle: "Donate to the wedding fund!",
  confirmedMsg: "LFGGGGG thank you so much!!",
});
