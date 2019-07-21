const get5moodsMenu = require("./lunch-parser");
const lunchManager = require("./lunch-manager");
const uuid4 = require("uuid/v4");
const childProcess = require("child_process");
const yaml = require("js-yaml");
const commands = require("./commands");

const BOT_UUID = uuid4();
console.info(`Started with UUID ${BOT_UUID}`);

const getStatus = async () => {
  const subscribers = await lunchManager.getSubscriberNumbers();
  let gitHash;
  try {
    gitHash = childProcess
      .execSync("git rev-parse HEAD")
      .toString()
      .substring(0, 7);
  } catch (err) {
    gitHash = "not a git repository";
  }
  return `Bot-UUID: ${BOT_UUID}
HEAD at: ${gitHash}
Up and running
Counting ${subscribers} subscribers`;
};

const getMenu = async () => {
  return await get5moodsMenu();
};

const isCurrentUserMention = (client, item) => {
  if (!item.text || !item.text.mentionedUsers) {
    return false;
  }
  const userId = client.loggedOnUser.userId;
  return item.text.mentionedUsers.includes(userId);
};

const getRegex = command => {
  return `(@.*\/${command})(.*$)`;
};

const getOptions = message => {
  message = message.replace(/\<br\>/g, "\n\n").trim();
  // matches things after the command so it can be parsed as yaml
  const groups = message.match(/(@.*\/\S*?\s)([\S\s]*)/);
  if (!groups) {
    return {};
  }
  let optionsString = groups[2].toString();
  if (!optionsString) {
    return {};
  }
  try {
    return yaml.safeLoad(optionsString);
  } catch (err) {
    if (err) {
      console.error(err);
      return {};
    }
  }
};

const parseCommand = async (client, item) => {
  if (!isCurrentUserMention(client, item)) {
    return;
  }
  const message = item.text.content;
  const creatorId = item.creatorId;
  const conversationId = item.convId;
  if (!message.match("/")) {
    // not a command
    return;
  }
  let response = {
    convId: item.convId,
    parentId: item.itemId,
    content: ""
  };

  const options = getOptions(message);
  if (options["uuid"] && options["uuid"] !== BOT_UUID) {
    return;
  }

  if (message.match(getRegex("status"))) {
    console.info("Got status request");
    response.content = await getStatus(item, response);
  } else if (message.match(getRegex("menu"))) {
    console.info("Got menu request");
    response.content = await getMenu();
  } else if (message.match(getRegex("subscribe"))) {
    response.content = await commands.subscribe(
      client,
      creatorId,
      conversationId,
      lunchManager,
      options
    );
  } else if (message.match(getRegex("unsubscribe"))) {
    const user = await client.getUserById(creatorId);
    response.content = await lunchManager.unsubscribe(
      conversationId,
      user.displayName
    );
    await lunchManager.updateCrons(client);
  } else if (message.match("source")) {
    response.content = "https://github.com/max-wittig/LunchBot";
  } else if (message.match("show-subscription")) {
    const showSubscription = await lunchManager.getSubscription(conversationId);
    if (!showSubscription) {
      response.content =
        "Not subscribed yet. Use /subscribe to add a subscription";
    } else {
      response.content = JSON.stringify(showSubscription);
    }
  } else if (message.match("modify-subscription")) {
    const showSubscription = await lunchManager.getSubscription(conversationId);
    if (!showSubscription) {
      response.content =
        "Not subscribed yet. Use /subscribe to add a subscription";
    } else {
      response.content = await commands.modifySubscription(
        lunchManager,
        conversationId,
        options
      );
    }
  } else if (message.match("help")) {
    response.content = await commands.help();
  }

  if (!response.content) {
    response.content = `${item.text.content} is not a known command`;
  }

  client.addTextItem(response.convId, response).catch(err => {
    console.error(err);
  });
};

module.exports = parseCommand;
