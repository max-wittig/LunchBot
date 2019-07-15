const cronParser = require("cron-parser");
const moment = require("moment-timezone");

const getStrippedOptions = options => {
  const allowedKeys = [
    "timezone",
    "menuCron",
    "warningCron",
    "lunchCron",
    "uuid"
  ];
  const strippedOptions = {};
  Object.keys(options).forEach(key => {
    if (allowedKeys.includes(key)) strippedOptions[key] = options[key];
  });
  return strippedOptions;
};

const isValidCron = cronString => {
  if (!cronString) {
    return true;
  }
  try {
    const expression = cronParser.parseExpression(cronString);
    const expressionOne = expression.next();
    const expressionTwo = expression.next();
    const intervalMs = expressionTwo.toDate() - expressionOne.toDate();
    const minInterval = 10 * 60 * 1000;
    if (intervalMs < minInterval) {
      return false;
    } else {
      return true;
    }
  } catch (err) {
    console.error(err);
    return false;
  }
};

const isValidTimeZone = timezone => {
  if (!timezone) {
    // we accept undefined timezones, so we can use the default
    return true;
  }
  return moment.tz.names().includes(timezone);
};

const modifySubscription = async (lunchManager, conversationId, options) => {
  if (!options) {
    return "No options supplied";
  }
  if (options["timezone"] && !isValidTimeZone(options["timezone"])) {
    return "Invalid timezone";
  }
  const strippedOptions = getStrippedOptions(options);
  if (!strippedOptions) {
    return "No options supplied";
  }
  let modifyResponse;
  try {
    modifyResponse = await lunchManager.modifySubscription(
      conversationId,
      getStrippedOptions(options)
    );
    await lunchManager.updateCrons();
  } catch (err) {
    console.error(err);
    modifyResponse = "Could not modify subscription";
  }
  return modifyResponse;
};

const help = async () => {
  const availableCommands = [
    "help",
    "status",
    "subscribe",
    "unsubscribe",
    "modify-subscription",
    "show-subscription",
    "menu",
    "source"
  ];
  let helpString = "Available commands:";
  availableCommands.forEach(command => {
    helpString += `\n* /${command}`;
  });
  return helpString;
};

const subscribe = async (
  client,
  creatorId,
  conversationId,
  lunchManager,
  options
) => {
  const user = await client.getUserById(creatorId);
  const timezone = options["timezone"];
  const cronJobs = [
    options["menuCron"],
    options["warningCron"],
    options["lunchCron"]
  ];
  for (cron of cronJobs) {
    if (!isValidCron()) {
      return "Invalid cron";
    }
  }
  if (!isValidTimeZone(timezone)) {
    ("Timezone is invalid");
  }
  let returnMessage;
  returnMessage = await lunchManager.subscribe(
    new lunchManager.LunchSubscription(
      conversationId,
      creatorId,
      user.displayName,
      timezone,
      ...cronJobs
    )
  );
  const err = await lunchManager.updateCrons(client);
  if (err) {
    console.error(err);
    returnMessage = "Could not create subscription";
  }
  return returnMessage;
};

module.exports = {
  modifySubscription: modifySubscription,
  help: help,
  subscribe
};
