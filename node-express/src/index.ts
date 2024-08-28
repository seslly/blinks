import express from "express";
import {
  type ActionPostResponse,
  createPostResponse,
  type ActionGetResponse,
  type ActionsJson,
  createActionHeaders,
  MEMO_PROGRAM_ID,
  type NextAction,
  actionCorsMiddleware,
} from "@solana/actions";
import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { db, DEFAULT_MSG_SIGN, DEFAULT_SOL_AMOUNT } from "./constants";
import { routeLogger } from "./middleware";

const app = express();
const port = process.env.PORT || 3000;
const origin = process.env.ORIGIN || `http://localhost:${port}`;
const conn = new Connection(
  process.env.SOLANA_RPC! || clusterApiUrl("mainnet-beta"),
);
app.use(routeLogger);

// Website Stuff
app.use("/static", express.static("static"));
app.get("/", (_, res) => res.send("Working!"));

// API stuff
app.use(actionCorsMiddleware(createActionHeaders())); // set the headers for all routes below, required for actions to work properly

// work around a dialect bug where they send json payload callback as content-type text/plaintext
app.use(express.raw({ type: "text/*", limit: "1kb" }));
app.use((req, res, next) => {
  if (
    req.method === "POST" &&
    req.headers["content-type"] === "text/plain;charset=UTF-8"
  ) {
    try {
      console.warn(
        "👀 we're gonna try to parse because dialect can't POST with content-type: application/json or www-form-urlencoded",
      );
      req.body = JSON.parse(req.body);
    } catch (e) {
      console.error("could not parse, gl 🙏");
    }
  }
  next();
});

// parse json amd form payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Required for mapping out blink action routes
app.get("/actions.json", (_, res) => {
  const payload: ActionsJson = {
    rules: [
      // map all root level routes to an action
      {
        pathPattern: "/*",
        apiPath: "/donate/*",
      },
      // idempotent rule as the fallback
      {
        pathPattern: "/donate/**",
        apiPath: "/donate/**",
      },
    ],
  };
  res.send(payload);
});

app.get("/donate/:wallet", (req, res) => {
  const { wallet } = req.params;
  const donateUrl = `/donate/${wallet}`;
  const user = db.get(wallet);
  if (!user) return res.status(400).send("Wallet not in database");
  const payload: ActionGetResponse = {
    title: user.actionTitle,
    icon: `${origin}/static/img/${user.icon}`,
    description: user.description,
    label: "Transfer", // this value will be ignored since `links.actions` exists
    links: {
      actions: [
        {
          label: `Tip ${user.name} with SOL!`, // button text
          href: `${donateUrl}?amount={amount}&message={message}`, // this href will have a text input
          parameters: [
            {
              name: "amount", // parameter name in the `href` above
              label: "Enter the amount of SOL to tip", // placeholder of the text input
              type: "number",
              min: DEFAULT_SOL_AMOUNT,
              required: true,
            },
            {
              name: "message", // parameter name in the `href` above
              label: "Enter message to send with donation", // placeholder of the text input
              type: "text",
              required: true,
            },
          ],
        },
      ],
    },
  };
  res.send(payload);
});

app.post("/donate/:wallet", async (req, res) => {
  const { wallet } = req.params;
  let { amount, message } = req.query;
  const { account } = req.body;

  // validate params
  if (!amount || !message)
    return res.status(400).send({ error: "Amount and Message required" });

  // work around for another dialect issue where their test suite sends the literal '{amount}' and '{message}' to test
  const parsedAmount = amount === "{amount}" ? DEFAULT_SOL_AMOUNT : parseFloat(`${amount}`);
  if (!parsedAmount || parsedAmount <= 0) {
    console.error(`invalid amount ${amount}`);
    return res.status(400).send("Amount is too small");
  }

  let receiver: PublicKey;
  let sender: PublicKey;
  try {
    receiver = new PublicKey(wallet);
    sender = new PublicKey(account);
  } catch (e) {
    return res.status(400).send("Check wallet and account are valid addresses");
  }

  try {
    // ensure the receiving account will be rent exempt
    const minimumBalance = await conn.getMinimumBalanceForRentExemption(
      0, // note: simple accounts that just store native SOL have `0` bytes of data
    );

    // create an instruction to transfer native SOL from one wallet to another
    const transferSolInstruction = SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: receiver,
      lamports: parsedAmount * LAMPORTS_PER_SOL,
    });

    // get the latest blockhash amd block height
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();

    // create a legacy transaction
    const transaction = new Transaction({
      feePayer: sender,
      blockhash,
      lastValidBlockHeight,
    }).add(transferSolInstruction);

    transaction.add(
      new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(`${DEFAULT_MSG_SIGN + message}`, "utf8"),
        keys: [],
      }),
    );

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Send ${amount} SOL to ${receiver.toBase58()}`,
        links: {
          next: { type: "post", href: `/donate/${wallet}/confirmed` },
        },
      },
      // note: no additional signers are needed
      // signers: [],
    });

    return res.send(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server Error, check logs");
  }
});

// callback with confirmed tx and executing account (wallet address)
app.post("/donate/:wallet/confirmed", (req, res) => {
  const { wallet } = req.params;
  const { account, signature } = req.body;
  console.log(
    `Callback received -- account: ${account} confirmed tx: ${signature}`,
  );
  const user = db.get(wallet);
  if (!user) return res.status(400).send("Wallet not in database");

  const nextAction: NextAction = {
    type: "completed",
    icon: `${origin}/static/img/${user.icon}`,
    title: user.confirmedMsg,
    description: user.description,
    label: "Donated!",
  };
  res.send(nextAction);
});

app.listen(port, () =>
  console.warn(`Successful start up at :${port} open up localhost:${port}`),
);
