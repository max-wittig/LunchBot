const parse = require("node-html-parser").parse;
const request = require("request-promise");

const get5MoodsMenu = async () => {
  const url = "https://siemens.sv-restaurant.ch/de/menuplan/five-moods/";
  let text = "";
  try {
    const result = await request(url);
    const root = parse(result);
    const tab1 = root.querySelector("#menu-plan-tab1");
    const menuItems = tab1.querySelectorAll(".menu-item");
    for (const item of menuItems) {
      const menuItem = parse(item.querySelector(".item-content").innerHTML);
      const menuLine = menuItem.querySelector(".menuline").innerHTML;
      const menuTitle = menuItem.querySelector(".menu-title").innerHTML;
      const menuTitleLine = "-".repeat(30);
      const menuDescription = menuItem
        .querySelector(".menu-description")
        .innerHTML.replace(/<br \/>/g, "");
      text += `${menuLine}\n${menuTitleLine}\n${menuTitle}\n${menuDescription}\n\n`;
    }
  } catch (err) {
    console.error(err);
    text = "Menu not available";
  }
  return new Promise(resolve => {
    resolve(text);
  });
};

module.exports = get5MoodsMenu;
