import * as tmi from "tmi.js";
import Redis from "ioredis";
import "dotenv/config";

const channels = process.env.TWITCH_CHANNELS?.split(",") || [];

const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_TOKEN,
  },
  channels: channels,
});

client.connect().catch(console.error);
client.on(
  "message",
  (channel, tags, message, self) =>
    handleMessage(channel, tags, message, self) as any
);

async function initRedis() {
  let url: string;

  if (process.env.NODE_ENV !== "production") {
    return new Redis(process.env.REDIS_URL_DEV ?? "");
  } else {
    console.log("PROD");
    return new Redis({
      host: process.env.REDIS_URL ?? "",
      port: parseInt(process.env.REDIS_PORT ?? "6379"),
    });
  }
}

const number2level = (number: number) => {
  switch (number) {
    case 0:
      return "Viewer";
    case 1:
      return "Subscriber";
    case 2:
      return "VIP";
    case 3:
      return "Moderator";
    default:
      return "Viewer";
  }
};

const level2number = (level: string) => {
  switch (level.toLowerCase()) {
    case "viewer":
      return 0;
    case "subscriber":
      return 1;
    case "vip":
      return 2;
    case "moderator":
      return 3;
    case "v":
      return 0;
    case "s":
      return 1;
    case "m":
      return 3;
    default:
      return 0;
  }
};
const userLevel = (tags: tmi.ChatUserstate) => {
  if (tags["user-id"] === tags["room-id"]) return 3;
  if (tags["mod"]) return 3;
  if (tags["vip"]) return 2;
  if (tags["subscriber"]) return 1;
  return 0;
};

const checkMod = (tags: tmi.ChatUserstate) => {
  if (tags["user-id"] === tags["room-id"]) return true;
  if (tags["mod"]) return true;
  return false;
};

async function joinQueue(redis: Redis, channel: string, username: string) {
  const now = new Date().getTime();
  const data = await redis.zadd(channel, "NX", now, username);
  if (data === 1) {
    return true;
  }
  return false;
}

async function leaveQueue(redis: Redis, channel: string, username: string) {
  const data = await redis.zrem(channel, username);
  if (data === 1) {
    return true;
  }
  return false;
}

async function getQueue(redis: Redis, channel: string) {
  const data = await redis.zrange(channel, 0, -1);
  return data;
}

async function getQueueNumber(redis: Redis, channel: string, length: number) {
  const data = await redis.zrange(channel, 0, length - 1);
  return data;
}

async function getQueuePosition(
  redis: Redis,
  channel: string,
  username: string
) {
  const data = await redis.zrank(channel, username);
  return data;
}

async function getQueueRandom(redis: Redis, channel: string, length: number) {
  const data = await redis.zrandmember(channel, length);
  return data;
}

async function getQueueCount(redis: Redis, channel: string) {
  const data = await redis.zcard(channel);
  return data;
}

async function setQueueStatus(redis: Redis, channel: string, open: boolean) {
  if (open) {
    await redis.set(`${channel}-status`, "open");
  } else {
    await redis.set(`${channel}-status`, "closed");
  }
  return true;
}

async function getQueueStatus(redis: Redis, channel: string) {
  const data = await redis.get(`${channel}-status`);
  return data === "open";
}

async function setQueueLength(redis: Redis, channel: string, length: number) {
  await redis.set(`${channel}-length`, length.toString());
  return true;
}

async function getQueueLength(redis: Redis, channel: string) {
  const data = await redis.get(`${channel}-length`);
  return parseInt(data ?? "0");
}

async function setQueueLevel(redis: Redis, channel: string, level: string) {
  await redis.set(`${channel}-level`, level);
  return true;
}

async function getQueueLevel(redis: Redis, channel: string) {
  const data = await redis.get(`${channel}-level`);
  return data ?? "Viewer";
}

async function drawQueue(redis: Redis, channel: string, length: number) {
  return await redis.zpopmin("nikkijustine", length);
}

async function drawQueueRandom(redis: Redis, channel: string, length: number) {
  const data = await getQueueRandom(redis, channel, length);
  await redis.zrem(channel, data);
  return data;
}

async function clearQueue(redis: Redis, channel: string) {
  await redis.del(channel);
  return true;
}

async function queue(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    const redis = await initRedis();
    const queueInfo = await Promise.all([
      getQueue(redis, channel),
      getQueueLength(redis, channel),
      getQueueLevel(redis, channel),
      getQueueStatus(redis, channel),
      getQueueCount(redis, channel),
    ]);

    const [queue, queueLength, queueLevel, queueStatus, queueCount] = queueInfo;

    if (queueStatus === false) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently closed.`
      );
      return;
    }

    if (queueCount === 0) {
      if (queueLength === 0) {
        client.say(
          channel,
          `@${tags["display-name"]}, the queue is currently empty. The queue is currently open to ${queueLevel} and above.`
        );
        return;
      }

      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently empty. With a maximum of ${queueLength} people in the queue. The queue is currently open to ${queueLevel} and above.`
      );
      return;
    }

    if (queueLength === 0) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently open to ${queueLevel} and above. There are currently ${queueCount} people in the queue.`
      );
      return
    }


    client.say(
      channel,
      `@${tags["display-name"]}, the queue is currently open to ${queueLevel} and above. There are currently ${queueCount} people in the queue. The queue is set to a maximum of ${queueLength} people long.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function join(channel: string, tags: tmi.ChatUserstate, message: string) {
  try {
    const redis = await initRedis();

    const queueInfo = await Promise.all([
      getQueueLength(redis, channel),
      getQueueLevel(redis, channel),
      getQueueStatus(redis, channel),
      getQueueCount(redis, channel),
      getQueuePosition(redis, channel, tags["display-name"] ?? ""),
    ]);

    const [length, level, status, count, position] = queueInfo;

    if (status === false) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently closed.`
      );
      return;
    }

    if (level2number(level) > userLevel(tags)) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently open to ${level} and above.`
      );
      return;
    }

    if (count === length && length !== 0) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently full. Please wait for someone to leave the queue.`
      );
      return;
    }

    if (position !== null) {
      client.say(
        channel,
        `@${tags["display-name"]}, you are already in the queue at position ${
          position + 1
        }.`
      );
      return;
    }

    const success = await joinQueue(redis, channel, tags["display-name"] ?? "");

    if (!success) {
      client.say(
        channel,
        `@${tags["display-name"]}, you are already in the queue.`
      );
      return;
    }

    const newPosition = await getQueuePosition(
      redis,
      channel,
      tags["display-name"] ?? ""
    );

    if (newPosition === null) {
      client.say(
        channel,
        `@${tags["display-name"]}, you are not currently in the queue.`
      );
      return;
    }

    client.say(
      channel,
      `@${tags["display-name"]}, you have been added to the queue at position ${
        newPosition + 1
      }.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function leave(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    const redis = await initRedis();

    const position = await getQueuePosition(
      redis,
      channel,
      tags["display-name"] ?? ""
    );

    if (position === null) {
      client.say(
        channel,
        `@${tags["display-name"]}, you are not currently in the queue.`
      );
      return;
    }

    await leaveQueue(redis, channel, tags["display-name"] ?? "");

    client.say(
      channel,
      `@${tags["display-name"]}, you have been removed from the queue.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function open(channel: string, tags: tmi.ChatUserstate, message: string) {
  try {
    if (!checkMod(tags)) {
      return;
    }

    const redis = await initRedis();

    const queueInfo = await Promise.all([
      getQueueLength(redis, channel),
      getQueueLevel(redis, channel),
      getQueueStatus(redis, channel),
    ]);

    const [length, level, status] = queueInfo;

    if (status === true) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is already open.`
      );
      return;
    }

    await setQueueStatus(redis, channel, true);

    if (length === 0) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is now open to ${level} and above.`
      );
      return;
    }

    client.say(
      channel,
      `@${tags["display-name"]}, the queue is now open to ${level} and above with a maximum of ${length} people in the queue.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function close(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    if (!checkMod(tags)) {
      return;
    }

    const redis = await initRedis();

    const status = await getQueueStatus(redis, channel);

    if (status === false) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is already closed.`
      );
      return;
    }

    await setQueueStatus(redis, channel, false);

    client.say(channel, `@${tags["display-name"]}, the queue is now closed.`);

    redis.disconnect();
  } catch (error) {}
}

async function clear(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    if (!checkMod(tags)) {
      return;
    }

    const redis = await initRedis();

    await clearQueue(redis, channel);

    client.say(
      channel,
      `@${tags["display-name"]}, the queue has been cleared.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function length(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    const redis = await initRedis();

    const length = await getQueueLength(redis, channel);

    if (length === 0) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently empty.`
      );
      return;
    }

    client.say(
      channel,
      `@${tags["display-name"]}, the queue is currently ${length} people long.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function level(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    const redis = await initRedis();

    const setLevel = message.split(" ")[1];

    if (setLevel !== undefined) {
      if (checkMod(tags)) {
        let newLevel: string;

        if (isNaN(parseInt(setLevel))) {
          newLevel = number2level(level2number(setLevel));
        } else {
          newLevel = number2level(parseInt(setLevel));
        }

        await setQueueLevel(redis, channel, newLevel);
        client.say(
          channel,
          `@${tags["display-name"]}, the queue is now open to ${newLevel} and above.`
        );

        redis.disconnect();

        return;
      }
    }

    const level = await getQueueLevel(redis, channel);

    client.say(
      channel,
      `@${tags["display-name"]}, the queue is currently open to ${level} and above.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function status(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    const redis = await initRedis();

    const status = await getQueueStatus(redis, channel);

    if (status === true) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently open.`
      );
    } else {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently closed.`
      );
    }

    redis.disconnect();
  } catch (error) {}
}

async function list(channel: string, tags: tmi.ChatUserstate, message: string) {
  try {
    const redis = await initRedis();

    const queue = await getQueue(redis, channel);

    if (queue.length === 0) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently empty.`
      );
      return;
    }

    let queueList = `@${tags["display-name"]}, the queue is currently `;

    for (let i = 0; i < queue.length; i++) {
      const temp =
        queueList +
        `${i + 1}. ${queue[i]}` +
        (i === queue.length - 1 ? "." : ", ");
      if (temp.length > 500) {
        queueList = queueList + ` ...`;
        break;
      }
      queueList = temp;
    }

    client.say(channel, queueList);

    redis.disconnect();
  } catch (error) {}
}

async function limit(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    if (!checkMod(tags)) {
      return;
    }

    const redis = await initRedis();

    const length = parseInt(message.split(" ")[1]);

    if (isNaN(length)) {
      client.say(
        channel,
        `@${tags["display-name"]}, please specify a valid number.`
      );
      return;
    }

    await setQueueLength(redis, channel, length);

    if (length === 0) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue limit has been removed.`
      );
      return;
    }

    client.say(
      channel,
      `@${tags["display-name"]}, the queue limit has been set to ${length}.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function pick(channel: string, tags: tmi.ChatUserstate, message: string) {
  try {
    if (!checkMod(tags)) {
      return;
    }

    const pickAmount = parseInt(message.split(" ")[1]) || 1;

    if (isNaN(pickAmount)) {
      client.say(
        channel,
        `@${tags["display-name"]}, please specify a valid number.`
      );
      return;
    }

    const redis = await initRedis();

    const queueInfo = await Promise.all([
      getQueue(redis, channel),
      getQueueLength(redis, channel),
      getQueueCount(redis, channel),
    ]);

    const [queue, queueLength, queueCount] = queueInfo;

    if (queue.length === 0) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently empty.`
      );
      return;
    }

    if (queue.length < pickAmount) {
      client.say(
        channel,
        `@${tags["display-name"]}, there are not enough people in the queue.`
      );
      return;
    }

    const picked = await drawQueue(redis, channel, pickAmount);

    const pickedList = picked
      .map((user, index) => {
        return `${index + 1}. ${user}`;
      })
      .join(", ");

    client.say(
      channel,
      `@${tags["display-name"]}, the following users have been picked: ${pickedList}`
    );

    redis.disconnect();
  } catch (error) {}
}

async function rand(channel: string, tags: tmi.ChatUserstate, message: string) {
  try {
    if (!checkMod(tags)) {
      return;
    }

    const pickAmount = parseInt(message.split(" ")[1]) || 1;

    if (isNaN(pickAmount)) {
      client.say(
        channel,
        `@${tags["display-name"]}, please specify a valid number.`
      );
      return;
    }

    const redis = await initRedis();

    const queueInfo = await Promise.all([
      getQueue(redis, channel),
      getQueueLength(redis, channel),
      getQueueCount(redis, channel),
    ]);

    const [queue, queueLength, queueCount] = queueInfo;

    if (queue.length === 0) {
      client.say(
        channel,
        `@${tags["display-name"]}, the queue is currently empty.`
      );
      return;
    }

    if (queue.length < pickAmount) {
      client.say(
        channel,
        `@${tags["display-name"]}, there are not enough people in the queue.`
      );
      return;
    }

    const picked = await drawQueueRandom(redis, channel, pickAmount);

    const pickedList = picked
      .map((user, index) => {
        return `${index + 1}. ${user}`;
      })
      .join(", ");

    client.say(
      channel,
      `@${tags["display-name"]}, the following users have been picked: ${pickedList}`
    );

    redis.disconnect();
  } catch (error) {}
}

async function remove(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    if (!checkMod(tags)) {
      return;
    }

    const redis = await initRedis();

    const username = message.split(" ")[1].replace("@", "");

    if (!username) {
      client.say(
        channel,
        `@${tags["display-name"]}, please specify a username.`
      );
      return;
    }

    const success = await leaveQueue(redis, channel, username);

    if (!success) {
      client.say(
        channel,
        `@${tags["display-name"]}, ${username} is not in the queue.`
      );
      return;
    }

    client.say(
      channel,
      `@${tags["display-name"]}, ${username} has been removed from the queue.`
    );

    redis.disconnect();
  } catch (error) {}
}

async function joinchannel(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    if (tags["room-id"] !== process.env.TWITCH_CHANNEL_ID) {
      return;
    }
    await client.join(tags.username as string);

    client.say(
      channel,
      `@${tags["display-name"]}, I have joined your channel.`
    );
  } catch (error) {}
}

async function leavechannel(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    if (tags["room-id"] !== process.env.TWITCH_CHANNEL_ID) {
      return;
    }
    await client.part(tags.username as string).catch((err) => {});

    client.say(channel, `@${tags["display-name"]}, I have left your channel.`);
  } catch (error) {}
}

async function manualJoin(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string
) {
  try {
    if (tags["room-id"] !== process.env.TWITCH_CHANNEL_ID) {
      return;
    }

    if (tags.username?.toLowerCase() !== "xnugget_") {
      return;
    }

    const username = message.split(" ")[1].replace("@", "");

    if (!username) {
      client.say(
        channel,
        `@${tags["display-name"]}, please specify a username.`
      );
      return;
    }
    await client.join(username);

    client.say(
      channel,
      `@${tags["display-name"]}, I have joined ${username}.`
    );
  } catch (error) {}
}

async function handleMessage(
  channel: string,
  tags: tmi.ChatUserstate,
  message: string,
  self: boolean
) {
  if (self) return;
  if (!message.startsWith("!")) return;
  message = message.toLowerCase();
  const command = message.split(" ")[0];

  if (tags["room-id"] === process.env.TWITCH_CHANNEL_ID) {
    if (command === "!help") {
      // return help(channel, tags, message);
    }
  }

  try {
    switch (command) {
      case "!joinchannel":
        joinchannel(channel, tags, message);
        break;
      case "!leavechannel":
        leavechannel(channel, tags, message);
        break;
      case "!manualjoin":
        manualJoin(channel, tags, message);
        break;
      // case "!help":
      //   qhelp(channel, tags, message);
      //   break;
      case "!queue":
        queue(channel, tags, message);
        break;
      case "!join":
        join(channel, tags, message);
        break;
      case "!leave":
        leave(channel, tags, message);
        break;
      case "!open":
        open(channel, tags, message);
        break;
      case "!close":
        close(channel, tags, message);
        break;
      case "!clear":
        clear(channel, tags, message);
        break;
      case "!length":
        length(channel, tags, message);
        break;
      case "!level":
        level(channel, tags, message);
        break;
      case "!list":
        list(channel, tags, message);
        break;
      case "!limit":
        limit(channel, tags, message);
        break;
      case "!pick":
        pick(channel, tags, message);
        break;
      case "!rand":
        rand(channel, tags, message);
        break;
      case "!remove":
        remove(channel, tags, message);
        break;
      // case "!blacklist":
      //   blacklist(channel, tags, message);
      //   break;
      // case "!unblacklist":
      //   unblacklist(channel, tags, message);
      //   break;
      // case "!qhelp":
      //   qhelp(channel, tags, message);
      default:
        break;
    }
  } catch (e) {
    console.error(e);
  }
}
