const parse = require("node-html-parser").parse;
const http = require("http");
const request = require("request-promise");

function get5MoodsMenu(callback) {
  const url = "http://siemens.sv-restaurant.ch/de/menuplan/five-moods/";
  let text = "";
  request(url).then(result => {
    const root = parse(result);
    const tab1 = root.querySelector("#menu-plan-tab2");
    const menuItems = tab1.querySelectorAll(".menu-item");
    for (const item of menuItems) {
      const menuItem = parse(item.querySelector(".item-content").innerHTML);
      const menuLine = menuItem
        .querySelector(".menuline")
        .innerHTML;
      const menuTitle = menuItem.querySelector(".menu-title").innerHTML;
      const menuTitleLine = "-".repeat(30);
      const menuDescription = menuItem.querySelector(".menu-description")
        .innerHTML.replace(/<br \/>/g, "");
      text += `${menuLine}\n${menuTitleLine}\n${menuTitle}\n${menuDescription}\n\n`;
    }
    return callback(text);
  });
}

module.exports = get5MoodsMenu;
