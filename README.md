# LunchBot

Circuit Client, which uses the Javascript SDK to provide a LunchBot

## Usage

```sh
yarn install
yarn start
```

## Required environment variables

* CLIENT_ID
* CLIENT_SECRET
* CONVERSATION_ID

## Optional environment variables

* DOMAIN : domain of your Circuit enviroment. Defaults to `circuitsandbox.net`
* TEST_MODE : wether to run in test mode
* MENU_TIME_CRON : cron string, when to send the menu to the conversation. Defaults to `00 10 * * 1-5`
* WARNING_TIME_CRON : cron string, when to ask if anyone is joining. Defaults to `20 11 * * 1-5`
* LUNCH_TIME_CRON : cron string, when to send go to lunch message. Defaults to `30 11 * * 1-5`

The domain can also be specified by setting the `DOMAIN` variable.
Defaults to `circuitsandbox.net`

## Docker usage

```sh
# build the image
docker build -t lunchbot .

# run the bot
docker run --rm -d -e CLIENT_ID=$CLIENT_ID -e CLIENT_SECRET=$CLIENT_SECRET -e CONVERSATION_ID=$CONVERSATION_ID lunchbot

# or use the upstream image directly
docker run --rm -d -e CLIENT_ID=$CLIENT_ID -e CLIENT_SECRET=$CLIENT_SECRET -e CONVERSATION_ID=$CONVERSATION_ID registry.gitlab.com/max-wittig/lunchbot:latest
```
