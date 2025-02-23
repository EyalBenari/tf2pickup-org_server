import { EventEmitter } from 'events';

const { Collection, EmbedBuilder, GatewayIntentBits } =
  jest.requireActual('discord.js');

export class Message {}

export class TextChannel {
  constructor(public name: string) {}
  send(message: string) {
    return Promise.resolve(new Message());
  }
}

export const playersChannel = new TextChannel('players');
export const adminChannel = new TextChannel('admins');

export class Role {
  constructor(public name: string) {}

  mentionable = true;

  toString() {
    return `&<${this.name}>`;
  }
}

export const pickupsRole = new Role('pickups');

export class Guild {
  constructor(public name: string) {}

  available = true;

  channels = {
    cache: new Collection([
      ['queue', playersChannel],
      ['players', adminChannel],
    ]),
  };

  roles = {
    cache: new Collection([['pickups', pickupsRole]]),
  };

  emojis = {
    cache: new Collection([]),
    create: jest.fn().mockImplementation((attachment, name) => {
      const emoji = { name, toString: () => `<emoji:${name}>` };
      this.emojis.cache.set(name, emoji);
      return Promise.resolve(emoji);
    }),
  };
}

export class Client extends EventEmitter {
  static _instance: Client;

  user = { tag: 'bot#1337' };
  guilds = {
    cache: new Collection([['guild1', new Guild('FAKE_GUILD')]]),
  };

  constructor(public readonly options: any) {
    super();
    Client._instance = this;
  }

  login(token: string) {
    return Promise.resolve('FAKE_TOKEN');
  }
}

export { EmbedBuilder, GatewayIntentBits };
