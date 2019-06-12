const get5moodsMenu = require("./lunch-parser");

const getStatus = item => {
  return "Up and running";
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
}

const getRegex = (command) => {
    return `@.*\/${command}.*$`
};

const parseCommand = async (client, item) => {
  if (!isCurrentUserMention(client, item)) {
    return;
  }
  const message = item.text.content;
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
    response.content = getStatus(item, response);
  } else if (message.match(getRegex("menu"))) {
    console.info("Got menu request");
    response.content = await getMenu();
  }

  if (!response.content) {
    response.content = `${item.text.content} is not a known command`;
  }

  client.addTextItem(response.convId, response);
};

module.exports = parseCommand;
