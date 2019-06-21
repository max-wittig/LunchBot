# LunchBot

Circuit Client, which uses the Javascript SDK to provide a LunchBot

## Usage

Make sure that you have a mongodb instance running on localhost listening on port 27017.
See below how to customize that.

```sh
yarn
yarn start
```

## Required environment variables

* CLIENT_ID
* CLIENT_SECRET

## Optional environment variables

* DOMAIN : domain of your Circuit enviroment. Defaults to `circuitsandbox.net`
* TEST_MODE : wether to run in test mode
* MENU_TIME_CRON : cron string, when to send the menu to the conversation. Defaults to `00 10 * * 1-5`
* WARNING_TIME_CRON : cron string, when to ask if anyone is joining. Defaults to `20 11 * * 1-5`
* LUNCH_TIME_CRON : cron string, when to send go to lunch message. Defaults to `30 11 * * 1-5`
* SCOPE : define Circuit application scopes. Defaults to `null`
* MONGO_HOST : hostname that your mongodb is running on. Defaults to `localhost`
* MONGO_PORT : port that mongodb listens on. Defaults to `27017`

## Docker usage

```sh

# Easier way is just to use docker-compose
CLIENT_ID=$CLIENT_ID -e CLIENT_SECRET=$CLIENT_SECRET docker-compose up --build

# or you can also manually attach a mongo db instance

# build the image
docker build -t lunchbot .

# Start mongodb locally
docker run --rm -p 27017:27017 -d mongo

# run the bot
docker run --rm -d -e CLIENT_ID=$CLIENT_ID -e CLIENT_SECRET=$CLIENT_SECRET -e MONGO_HOST=localhost lunchbot

# or use the upstream image directly
docker run --rm -d -e CLIENT_ID=$CLIENT_ID -e CLIENT_SECRET=$CLIENT_SECRET -e MONGO_HOST=localhost registry.gitlab.com/max-wittig/lunchbot:latest
```

## Commands usage

You can requests the following information everytime, using slash command:

* /subscribe -> subscribe your conversation to receive the menu
* /unsubscribe -> unsubscribe from the conversation to receive the menu
* /status -> display status message, if bot is up and running
* /menu -> show lunch menu for today
* /source -> show source of the bot

### Options

While running some of the command above you can additionally also specify
some settings in yaml format.

You can always specify for which instance the command should be executed. 
This is useful for debugging, when multiple instances are running with the same
variables. You can check the UUID using the `/status` command.

Examples:
```
@LunchBot /menu
uuid: <some-uuid>
```

Special command options:

* timezone -> specifc the timezone the cron should be in. Defaults to `Europe/Zurich`
* cron -> specifc custom menu cron. Defaults to `0 10 * * 1-5`

```
@LunchBot /subscribe
timezone: Europe/Zurich
cron: 0 11 * * *
```
