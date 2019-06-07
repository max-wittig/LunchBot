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

The domain can also be specified by setting the `DOMAIN` variable.
Defaults to `circuitsandbox.net`

## Docker usage

```sh
# build the image
docker build -t lunchbot .

# run the bot
docker run --rm -d -e CLIENT_ID=<your-id> -e CLIENT_SECRET=<your-secret> -e CONVERSATION_ID=<your-conversation> lunchbot
