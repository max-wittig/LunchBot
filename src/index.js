const process = require("process");
const Circuit = require("circuit-sdk");
const parseCommand = require("./command-parser");
const lunchManager = require("./lunch-manager");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Please set the required variables!");
  process.exit(1);
}

const DOMAIN = process.env.DOMAIN || "circuitsandbox.net";
const SCOPE = process.env.SCOPE;

const setupClient = client => {
  client.setPresence({ state: Circuit.Enums.PresenceState.AVAILABLE });
  client.setStatusMessage("At Lunch");
};

const client = new Circuit.Client({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  domain: DOMAIN,
  scope: SCOPE
});

process.on("unhandledRejection", reason => {
  console.error("Unhandled Rejection at:", reason.stack || reason);
  throw reason;
});

client.addEventListener("itemAdded", async item => {
  item = item.item;
  const itemCreator = item.creatorId;
  if (itemCreator == client.loggedOnUser.userId) {
    return;
  }
  await parseCommand(client, item);
  await lunchManager.checkLunchResponse(client, item);
});

client.addEventListener("accessTokenRenewed", () => {
  console.info("Token renewed");
});

client.addEventListener("reconnectFailed", () => {
  console.error("Reconnect failed");
});

client.addEventListener("renewAccessTokenFailed", () => {
  console.error("renewAccessTokenFailed");
});

client.addEventListener("renewSessionTokenFailed", () => {
  console.error("renewSessionTokenFailed");
});

const start = async () => {
  try {
    await client.logon();
    setupClient(client);
    await lunchManager.updateCrons(client);
  } catch (err) {
    console.error(err);
  }
};

start();
