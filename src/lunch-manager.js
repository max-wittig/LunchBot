const MongoClient = require("mongodb").MongoClient;
const get5MoodsMenu = require("./lunch-parser");
const cronParser = require("cron-parser");
const CronJob = require("cron").CronJob;
const mongoHost = process.env.MONGO_HOST || "localhost";
const mongoPort = process.env.MONGO_PORT || "27017";
const mongoUrl = `mongodb://${mongoHost}:${mongoPort}`;
const dbName = "lunchbot";
const mongoClient = new MongoClient(mongoUrl, { useNewUrlParser: true });
const loadedCrons = [];
const lunchParticipients = {};

let db;
mongoClient.connect(err => {
  console.log("Connected successfully to server");

  db = mongoClient.db(dbName);
});
const subscriberCollectionName = "subscribers";

let MENU_TIME = process.env.MENU_TIME_CRON || "00 10 * * 1-5";
let WARNING_TIME = process.env.WARNING_TIME_CRON || "20 11 * * 1-5";
let LUNCH_TIME = process.env.LUNCH_TIME_CRON || "30 11 * * 1-5";

const TEST_MODE = process.env.TEST_MODE || false;

const PLEASE_JOIN_TEXT = "Please write 'yes' to join the lunch for today.";
const LETS_GO_TEXT = "Let's go. These people are joining: ";
const NOBODY_JOINS_TEXT = "Nobody is joining Lunch today.";

if (TEST_MODE) {
  MENU_TIME = "*/20 * * * * *";
  WARNING_TIME = "*/10 * * * * *";
  LUNCH_TIME = "*/5 * * * * *";
}

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

const subscribe = async lunchSubscription => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  const results = await subscriberCollection.findOne({
    conversationId: lunchSubscription.conversationId
  });
  if (results) {
    return `Already subscribed to ${lunchSubscription.conversationId} by ${results.subscribeUserName}`;
  } else {
    subscriberCollection.insertOne(
      {
        conversationId: lunchSubscription.conversationId,
        subscribeUserId: lunchSubscription.subscribeUserId,
        subscribeUserName: lunchSubscription.subscribeUserName,
        cron: lunchSubscription.cron
      },
      (err, result) => {
        console.error(err);
      }
    );

    return `Sucessfully subscribed to ${lunchSubscription.conversationId}`;
  }
};

const unsubscribe = async (conversationId, userName) => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  await subscriberCollection.deleteOne({ conversationId: conversationId });
  return `Subscription to ${conversationId} deleted by ${userName}`;
};

const lunchTimeDate = cronParser
  .parseExpression(LUNCH_TIME)
  .next()
  .toDate();
const lunchHumanTime = `[${lunchTimeDate.getHours()}:${lunchTimeDate.getMinutes()}]`;

const isValidLunchConfirmation = message => {
  for (const option of VALID_LUNCH_OPTIONS) {
    if (option.includes(message)) {
      console.info("LunchMessage is valid");
      return true;
    }
  }

  return false;
};

const randomLunchSpeak = () => {
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
};

const startConversation = async (
  client,
  conversationId,
  menuText,
  timeZone
) => {
  lunchParticipients[conversationId] = [];
  const item = await client.addTextItem(conversationId, menuText);

  let response = {
    convId: item.convId,
    parentId: item.itemId,
    content: ""
  };
  const lunchQuestion = new CronJob(
    WARNING_TIME,
    () => {
      lunchParticipients[conversationId].length = 0;
      response.content = `${randomLunchSpeak()} ${PLEASE_JOIN_TEXT}`;
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
            client.addTextItem(response.convId, response).catch(err => {
              console.error(err);
            });
            console.info("Added LetsGoMessage");
            letsGoJob.stop();
            lunchQuestion.stop();
          },
          null,
          true,
          timeZone
        );
      });
    },
    null,
    true,
    timeZone
  );
};

const sendLunchMenu = async (client, subscriber) => {
  const menu = await get5MoodsMenu();
  await startConversation(
    client,
    subscriber.conversationId,
    menu,
    subscriber.timeZone
  );
};

const updateCrons = async client => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  stopAllCrons();
  await subscriberCollection.find().forEach(subscriber => {
    const cronJob = new CronJob(
      subscriber.cron,
      async () => {
        await sendLunchMenu(client, subscriber);
      },
      null,
      true,
      subscriber.timeZone
    );
    loadedCrons.push(cronJob);
  });
};

const stopAllCrons = () => {
  for (const cron of loadedCrons) {
    console.debug("Stopped cronjob");
    cron.stop();
  }
  loadedCrons.length = 0;
};

const checkLunchResponse = async (client, item) => {
  const itemMessage = item.text.content;
  const conversationId = item.convId;

  if (isValidLunchConfirmation(itemMessage)) {
    const result = await client.getUserById(itemCreator);
    const username = result.displayName;
    if (!lunchParticipients[conversationId].includes(username)) {
      lunchParticipients[conversationId].push(username);
    }
  }
};

class LunchSubscription {
  constructor(
    conversationId,
    subscribeUserId,
    subscribeUserName,
    timeZone = "Europe/Zurich",
    cron = MENU_TIME
  ) {
    this.conversationId = conversationId;
    this.subscribeUserId = subscribeUserId;
    this.subscribeUserName = subscribeUserName;
    this.timeZone = timeZone;
    this.cron = cron;
  }
}

module.exports = {
  subscribe: subscribe,
  unsubscribe: unsubscribe,
  LunchSubscription: LunchSubscription,
  updateCrons: updateCrons,
  checkLunchResponse: checkLunchResponse
};