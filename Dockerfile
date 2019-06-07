FROM node:dubnium

WORKDIR /opt/lunch-bot
COPY package.json yarn.lock ./

RUN yarn install

COPY . .

ENTRYPOINT ["yarn"]
CMD ["start"]
