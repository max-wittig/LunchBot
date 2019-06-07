const parse = require("node-html-parser").parse;
const http = require("http");
const request = require("request-promise");

function get5MoodsMenu(callback) {
  const url = "http://siemens.sv-restaurant.ch/de/menuplan/five-moods/";
  let text = "";
  request(url).then(result => {
    const root = parse(result);
    const tab1 = root.querySelector("#menu-plan-tab1");
    const menuItems = tab1.querySelectorAll(".menu-item");
    for (const item of menuItems) {
      const menuItem = item.querySelector(".item-content");
      const menuLine = menuItem
        .querySelector(".menuline")
        .innerHTML;
      const menuDescription = menuItem.querySelector(".menu-description")
        .innerHTML.replace(/<br \/>/g, "");
      text += `${menuLine}\n${menuDescription}`;
    }
    return callback(text);
  });
}

get5MoodsMenu((menu) => {
    console.info(menu);
})
module.exports = get5MoodsMenu;
