// No client_secret needed for Implicit Grant. SDK will obtain access token.
const process = require("process");
const Circuit = require("circuit-sdk");
const CronJob = require("cron").CronJob;

CLIENT_ID = process.env.CLIENT_ID;
CLIENT_SECRET = process.env.CLIENT_SECRET;
CONVERSATION_ID = process.env.CONVERSATION_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !CONVERSATION_ID) {
  console.error("Please set the required variables!");
  process.exit(1);
}

DOMAIN = process.env.DOMAIN || "circuitsandbox.net";

const VALID_LUNCH_OPTIONS = [
  "ok",
  "okay",
  "yes",
  "jo",
  "ja",
  "yep",
  "jep",
  "natürlich",
  "+1",
  "y"
];
const IS_TEST = true;

const WARNING_TIME = "20 11 * * 1-5";
const LUNCH_TIME = "30 11 * * 1-5";
const LUNCH_HUMAN_TIME = " [11:30]";

const CHAT_ID = process.env.CIRCUIT_CHAT_ID;
const PLEASE_JOIN_TEXT = "Please write 'yes' to join the lunch for today.";
const LETS_GO_TEXT = "Let's go. These people are joining: ";
const NOBODY_JOINS_TEXT = "Nobody is joining Lunch today.";

const lunchParticipients = [];

function isValidLunchConfirmation(message) {
  return true;
}

function randomLunchSpeak() {
  const lunchSpeaks = [
    "Lunch?",
    "Essen?",
    "Le déjeuner?",
    "Mampf?",
    "Almoço?",
    "Futtern?"
  ];
  const randomInt = Math.floor(Math.random() * lunchSpeaks.length);
  return lunchSpeaks[randomInt] + LUNCH_HUMAN_TIME;
}

const client = new Circuit.Client({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  domain: DOMAIN
});

client.addEventListener("itemAdded", item => {
  item = item.item;
  const itemCreator = item.creatorId;
  if (itemCreator == client.loggedOnUser.userId) {
    return;
  }
  const itemMessage = item.text.content;
  if (isValidLunchConfirmation(itemMessage)) {
    client.getUserById(itemCreator).then(result => {
      username = result.displayName;
      if (!lunchParticipients.includes(username)) {
        lunchParticipients.push(username);
      }
    });
  }
});

client
  .logon()
  .then(() => {
    new CronJob(
      WARNING_TIME,
      () => {
        lunchParticipients.length = 0;
        client
          .addTextItem(
            CONVERSATION_ID,
            randomLunchSpeak() + " " + PLEASE_JOIN_TEXT
          )
          .then(item => {
            const letsGoJob = new CronJob(
              LUNCH_TIME,
              () => {
                let response = {
                  convId: item.convId,
                  parentId: item.itemId,
                  content: ""
                };
                if (lunchParticipients.length > 0) {
                  response.content =
                    LETS_GO_TEXT + lunchParticipients.toString();
                } else {
                  response.content = NOBODY_JOINS_TEXT;
                }
                client.addTextItem(item.convId, response);
                letsGoJob.stop();
              },
              null,
              true,
              "Europe/Zurich"
            );
          });
      },
      null,
      true,
      "Europe/Zurich"
    );
  })
  .catch(e => {
    console.error(
      "[" + new Date().toISOString() + "]",
      "ERROR:",
      "CircuitSDK",
      "logon",
      e
    );
  });
