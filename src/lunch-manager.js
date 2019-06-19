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
  console.debug("Connected to mongodb");
  db = mongoClient.db(dbName);
  if (err) {
    console.error(err);
    process.exit(3);
  }
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
        cron: lunchSubscription.cron,
        timeZone: lunchSubscription.timeZone
      },
      err => {
        if (err) {
          console.error(err);
        }
      }
    );

    return `Sucessfully subscribed to ${lunchSubscription.conversationId}`;
  }
};

const unsubscribe = async (conversationId, userName) => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  try {
    await subscriberCollection.deleteOne({ conversationId: conversationId });
  } catch (err) {
    console.error(`Could not delete conversation ${err}`);
  }
  return `Subscription to ${conversationId} deleted by ${userName}`;
};

const getSubscriberNumbers = async () => {
  const stats = await db.collection(subscriberCollectionName).stats();
  return stats["count"];
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
  try {
    const item = await client.addTextItem(conversationId, menuText);

    let response = {
      convId: item.convId,
      parentId: item.itemId,
      content: ""
    };
    const lunchQuestion = new CronJob(
      WARNING_TIME,
      async () => {
        lunchParticipients[conversationId] = [];
        response.content = `${randomLunchSpeak()} ${PLEASE_JOIN_TEXT}`;
        await client.addTextItem(response.convId, response);
        console.debug("Added LunchQuestion");
        const letsGoJob = new CronJob(
          LUNCH_TIME,
          async () => {
            if (lunchParticipients[conversationId].length > 0) {
              response.content =
                LETS_GO_TEXT + lunchParticipients[conversationId].toString();
            } else {
              response.content = NOBODY_JOINS_TEXT;
            }
            await client.addTextItem(response.convId, response);
            console.debug("Added LetsGoMessage");
            letsGoJob.stop();
            lunchQuestion.stop();
          },
          null,
          true,
          timeZone
        );
      },
      null,
      true,
      timeZone
    );
  } catch (err) {
    console.error(`Error in startConversation ${err}`);
  }
};

const sendLunchMenu = async (client, subscriber) => {
  try {
    const menu = await get5MoodsMenu();
    await startConversation(
      client,
      subscriber.conversationId,
      menu,
      subscriber.timeZone
    );
  } catch (err) {
    console.error(err);
  }
};

const updateCrons = async client => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  stopAllCrons();
  await subscriberCollection.find().forEach(subscriber => {
    const cronJob = new CronJob(
      subscriber.cron,
      async () => {
        try {
          await sendLunchMenu(client, subscriber);
        } catch (err) {
          console.error(err);
        }
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
  const itemCreator = item.creatorId;

  if (isValidLunchConfirmation(itemMessage)) {
    try {
      const result = await client.getUserById(itemCreator);
      const username = result.displayName;
      if (!lunchParticipients[conversationId].includes(username)) {
        lunchParticipients[conversationId].push(username);
      }
    } catch (err) {
      console.error(err);
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
  checkLunchResponse: checkLunchResponse,
  getSubscriberNumbers: getSubscriberNumbers
};
