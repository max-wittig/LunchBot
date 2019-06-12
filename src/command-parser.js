const get5moodsMenu = require("./lunch-parser");

const getStatus = item => {
  return "Up and running";
};

const getMenu = async () => {
  return await get5moodsMenu();
};

const parseCommand = async (client, item) => {
  if (!item.text) {
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

  if (message.match("^/status$")) {
    response.content = getStatus(item, response);
  } else if (message.match("^/menu$")) {
    response.content = await getMenu();
  }

  client.addTextItem(response.convId, response);
};

module.exports = parseCommand;
