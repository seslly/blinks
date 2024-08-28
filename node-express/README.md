# blink

Solana blink actions client implemented in Node.JS using Express and Bun

This project was created using `bun init` in bun v1.0.26. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

To install dependencies:

```bash
bun install
```

This is setup to have a database (currently just in memory) of various different wallets and their basic blink configuration. To add your wallet open the `./src/constants.ts` file and add the following

```
db.set("<wallet-address-here>", {
  name: "Your friendly name here",
  icon: "MyPfP.png", //copy your image into the `./static/img/` folder
  description: "This will show up as a lil description on the blink",
  actionTitle: "This is the title for my blink",
  confirmedMsg: "This is what the user will see once they confirm a tx",
});
```

To run:

```bash
bun dev
```

Navigate to `http://localhost:3000/donate/<wallet-address-here>` and you will see your action in raw JSON format.

Test how your blink would look at the Dialect developer portal https://dial.to/developer and copy your donate address
