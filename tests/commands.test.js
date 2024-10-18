import { Telegraf } from 'telegraf';
import { setupCommands } from '../commands.js';
import * as database from '../database.js';

jest.mock('../database.js');

describe('Bot Commands', () => {
  let bot;

  beforeEach(() => {
    bot = new Telegraf('fake-token');
    setupCommands(bot);
  });

  test('start command', async () => {
    const ctx = {
      reply: jest.fn(),
    };

    await bot.handleUpdate({ message: { text: '/start' } }, ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Welcome to the MEME Broker'));
  });

  // Add more tests for other commands
});
