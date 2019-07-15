const MongoClient = require("mongodb").MongoClient;
const get5MoodsMenu = require("./lunch-parser");
const cronParser = require("cron-parser");
const CronJob = require("cron").CronJob;
const mongoHost = process.env.MONGO_HOST || "localhost";
const mongoPort = process.env.MONGO_PORT || "27017";
const mongoUrl = process.env.MONGO_URL || `mongodb://${mongoHost}:${mongoPort}`;
const dbName = "lunchbot";
const mongoClient = new MongoClient(mongoUrl, { useNewUrlParser: true });
const loadedCrons = [];
const lunchParticipients = {};

let db;
mongoClient.connect(err => {
  console.debug("Connected to mongodb");
  if (err) {
    console.error(err);
    process.exit(3);
  }
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
    subscriberCollection.insertOne(lunchSubscription.toObject(), err => {
      if (err) {
        console.error(err);
      }
    });

    return `Sucessfully subscribed to ${lunchSubscription.conversationId}`;
  }
};

const unsubscribe = async (conversationId, userName) => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  return new Promise(async resolve => {
    try {
      await subscriberCollection.deleteOne({ conversationId: conversationId });
      resolve(`Subscription to ${conversationId} deleted by ${userName}`);
    } catch (err) {
      console.error(`Could not delete conversation ${err}`);
      resolve("Could not delete subscription");
    }
  });
};

const getSubscription = async conversationId => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  try {
    return await subscriberCollection.findOne({
      conversationId: conversationId
    });
  } catch (err) {
    console.error("Could not find conversation");
  }
};

const modifySubscription = async (conversationId, options) => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  try {
    await subscriberCollection.findOneAndUpdate(
      { conversationId: conversationId },
      { $set: options }
    );
    return "Modified subscription. Use /show-subscription to show your current settings";
  } catch (err) {
    console.error(err);
    return "Could not modify subscription";
  }
};

const getSubscriberNumbers = async () => {
  try {
    const stats = await db.collection(subscriberCollectionName).stats();
    return stats["count"];
  } catch (err) {
    return 0;
  }
};

const getHumanLunchTime = cron => {
  const lunchTimeDate = cronParser
    .parseExpression(cron)
    .next()
    .toDate();
  return `[${lunchTimeDate.getHours()}:${lunchTimeDate.getMinutes()}]`;
};

const isValidLunchConfirmation = message => {
  for (const option of VALID_LUNCH_OPTIONS) {
    if (option.includes(message)) {
      console.info("LunchMessage is valid");
      return true;
    }
  }

  return false;
};

const randomLunchSpeak = cron => {
  const lunchSpeaks = [
    "Lunch?",
    "Essen?",
    "Le déjeuner?",
    "Mampf?",
    "Almoço?",
    "Futtern?"
  ];
  const randomInt = Math.floor(Math.random() * lunchSpeaks.length);
  return `${lunchSpeaks[randomInt]} ${getHumanLunchTime(cron)}`;
};

const startConversation = async (
  client,
  conversationId,
  menuText,
  timezone,
  warningCron,
  lunchCron
) => {
  try {
    const item = await client.addTextItem(conversationId, menuText);

    let response = {
      convId: item.convId,
      parentId: item.itemId,
      content: ""
    };
    const lunchQuestion = new CronJob(
      warningCron,
      async () => {
        lunchParticipients[conversationId] = [];
        response.content = `${randomLunchSpeak(lunchCron)} ${PLEASE_JOIN_TEXT}`;
        await client.addTextItem(response.convId, response);
        console.debug("Added LunchQuestion");
        const letsGoJob = new CronJob(
          lunchCron,
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
          timezone
        );
      },
      null,
      true,
      timezone
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
      subscriber.timezone,
      subscriber.warningCron,
      subscriber.lunchCron
    );
  } catch (err) {
    console.error(err);
  }
};

const updateCrons = async client => {
  const subscriberCollection = db.collection(subscriberCollectionName);
  stopAllCrons();
  await subscriberCollection.find().forEach(async subscriber => {
    let cronJob;
    try {
      cronJob = new CronJob(
        subscriber.menuCron,
        async () => {
          try {
            await sendLunchMenu(client, subscriber);
          } catch (err) {
            console.error(err);
            return err;
          }
        },
        null,
        true,
        subscriber.timezone
      );
      loadedCrons.push(cronJob);
    } catch (err) {
      console.debug("Could not add cronjob. Removing...");
      try {
        await subscriberCollection.deleteOne({
          conversationId: subscriber.conversationId
        });
      } catch (err) {
        console.error(`Could not delete subscription ${err}`);
      }
      return err;
    }
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
  if (!item.text || !item.text.content) {
    return;
  }
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
    timezone = "Europe/Zurich",
    menuCron = MENU_TIME,
    warningCron = WARNING_TIME,
    lunchCron = LUNCH_TIME
  ) {
    this.conversationId = conversationId;
    this.subscribeUserId = subscribeUserId;
    this.subscribeUserName = subscribeUserName;
    this.timezone = timezone;
    this.menuCron = menuCron;
    this.warningCron = warningCron;
    this.lunchCron = lunchCron;
  }

  toObject() {
    return {
      conversationId: this.conversationId,
      subscribeUserId: this.subscribeUserId,
      subscribeUserName: this.subscribeUserName,
      timezone: this.timezone,
      menuCron: this.menuCron,
      warningCron: this.warningCron,
      lunchCron: this.lunchCron
    };
  }
}

module.exports = {
  subscribe: subscribe,
  unsubscribe: unsubscribe,
  LunchSubscription: LunchSubscription,
  updateCrons: updateCrons,
  checkLunchResponse: checkLunchResponse,
  getSubscriberNumbers: getSubscriberNumbers,
  getSubscription: getSubscription,
  modifySubscription: modifySubscription
};
