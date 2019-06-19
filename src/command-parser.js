const get5moodsMenu = require("./lunch-parser");
const lunchManager = require("./lunch-manager");
const uuid4 = require("uuid/v4");
const childProcess = require("child_process");

const BOT_UUID = uuid4();

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
  return `Bot-UUID: ${BOT_UUID}\nHEAD at: ${gitHash}\nUp and running\nCounting ${subscribers} subscribers`;
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
  return `@.*\/${command}.*$`;
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

  if (message.match(getRegex("status"))) {
    console.info("Got status request");
    response.content = await getStatus(item, response);
  } else if (message.match(getRegex("menu"))) {
    console.info("Got menu request");
    response.content = await getMenu();
  } else if (message.match(getRegex("subscribe"))) {
    const user = await client.getUserById(creatorId);
    response.content = await lunchManager.subscribe(
      new lunchManager.LunchSubscription(
        conversationId,
        creatorId,
        user.displayName
      )
    );
    await lunchManager.updateCrons(client);
  } else if (message.match(getRegex("unsubscribe"))) {
    const user = await client.getUserById(creatorId);
    response.content = await lunchManager.unsubscribe(
      conversationId,
      user.displayName
    );
    await lunchManager.updateCrons(client);
  } else if (message.match("source")) {
    response.content = "https://github.com/max-wittig/LunchBot";
  }

  if (!response.content) {
    response.content = `${item.text.content} is not a known command`;
  }

  client.addTextItem(response.convId, response).catch(err => {
    console.error(err);
  });
};

module.exports = parseCommand;
