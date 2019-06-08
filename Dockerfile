FROM node:dubnium

WORKDIR /opt/lunch-bot
COPY package.json yarn.lock ./

RUN yarn

COPY . .

ENTRYPOINT ["yarn"]
CMD ["start"]
