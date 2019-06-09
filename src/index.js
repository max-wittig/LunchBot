const process = require("process");
const Circuit = require("circuit-sdk");
const CronJob = require("cron").CronJob;
const get5MoodsMenu = require("./lunch-parser");
const cronParser = require("cron-parser");

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CONVERSATION_ID = process.env.CONVERSATION_ID;

const TEST_MODE = process.env.TEST_MODE || false;
let MENU_TIME = process.env.MENU_TIME_CRON || "00 10 * * 1-5";
let WARNING_TIME = process.env.WARNING_TIME_CRON || "20 11 * * 1-5";
let LUNCH_TIME = process.env.LUNCH_TIME_CRON || "30 11 * * 1-5";

if (!CLIENT_ID || !CLIENT_SECRET || !CONVERSATION_ID) {
  console.error("Please set the required variables!");
  process.exit(1);
}
console.info(`TEST_MODE is ${TEST_MODE}`);

const DOMAIN = process.env.DOMAIN || "circuitsandbox.net";
const TIMEZONE = process.env.TIMEZONE || "Europe/Zurich";

const VALID_LUNCH_OPTIONS = [
  "ok",
  "okay",
  "yes",
  "jo",
  "ja",
  "yep",
  "jep",
  "natürlich",
  "klar",
  "isch guat",
  "+1",
  "y"
];

if (TEST_MODE) {
  MENU_TIME = "*/20 * * * * *";
  WARNING_TIME = "*/10 * * * * *";
  LUNCH_TIME = "*/5 * * * * *";
}

const lunchTimeDate = cronParser
  .parseExpression(LUNCH_TIME)
  .next()
  .toDate();
const lunchHumanTime = `[${lunchTimeDate.getHours()}:${lunchTimeDate.getMinutes()}]`;

const PLEASE_JOIN_TEXT = "Please write 'yes' to join the lunch for today.";
const LETS_GO_TEXT = "Let's go. These people are joining: ";
const NOBODY_JOINS_TEXT = "Nobody is joining Lunch today.";

const lunchParticipients = [];

function isValidLunchConfirmation(message) {
  for (const option of VALID_LUNCH_OPTIONS) {
    if (option.includes(message)) {
      console.info("LunchMessage is valid");
      return true;
    }
  }

  return false;
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
  return lunchSpeaks[randomInt] + lunchHumanTime;
}

const startConversation = (client, menuText) => {
  client.addTextItem(CONVERSATION_ID, menuText).then(item => {
    let response = {
      convId: item.convId,
      parentId: item.itemId,
      content: ""
    };
    const lunchQuestion = new CronJob(
      WARNING_TIME,
      () => {
        lunchParticipients.length = 0;
        response.content = randomLunchSpeak() + " " + PLEASE_JOIN_TEXT;
        client.addTextItem(response.convId, response).then(item => {
          console.info("Added LunchQuestion");
          const letsGoJob = new CronJob(
            LUNCH_TIME,
            () => {
              if (lunchParticipients.length > 0) {
                response.content = LETS_GO_TEXT + lunchParticipients.toString();
              } else {
                response.content = NOBODY_JOINS_TEXT;
              }
              client.addTextItem(response.convId, response);
              console.info("Added LetsGoMessage");
              letsGoJob.stop();
              lunchQuestion.stop();
            },
            null,
            true,
            TIMEZONE
          );
        });
      },
      null,
      true,
      TIMEZONE
    );
  });
};

const setupClient = client => {
  client.setPresence({ state: Circuit.Enums.PresenceState.AVAILABLE });
  client.setStatusMessage("At Lunch");
};

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
    setupClient(client);
    new CronJob(
      MENU_TIME,
      () => {
        get5MoodsMenu(menuText => {
          console.info("Add menu");
          startConversation(client, menuText);
        });
      },
      null,
      true,
      TIMEZONE
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
