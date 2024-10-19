import { Scenes, Markup } from 'telegraf';
import { getInlineKeyboard, getNavigationText, navigationMap } from './getInlineKeyboard.js';

const mainMenuScene = new Scenes.BaseScene('mainMenu');
mainMenuScene.enter(async (ctx) => {
    const text = getNavigationText('main');
    const keyboard = getInlineKeyboard('main');
    if (ctx.update.callback_query) {
        await ctx.editMessageText(text, keyboard);
    } else {
        await ctx.reply(text, keyboard);
    }
});

mainMenuScene.action(/.+/, async (ctx) => {
    const action = ctx.match[0];
    if (navigationMap[action]) {
        return ctx.scene.enter(action);
    }
    await ctx.answerCbQuery();
    await ctx.editMessageText(`You selected ${action} in the main menu`, Markup.inlineKeyboard([Markup.button.callback('Back to Main Menu', 'back_to_main_menu')]));
});

// Create scenes for each section in navigationMap
const scenes = Object.keys(navigationMap).map(section => {
    if (section === 'main') return null; // Skip 'main' as we've already created it

    const scene = new Scenes.BaseScene(section);
    scene.enter(async (ctx) => {
        const text = getNavigationText(section);
        const keyboard = getInlineKeyboard(section);
        if (ctx.update.callback_query) {
            await ctx.editMessageText(text, keyboard);
        } else {
            await ctx.reply(text, keyboard);
        }
    });
    scene.action(/.+/, async (ctx) => {
        const action = ctx.match[0];
        if (action === 'back_to_main_menu') {
            return ctx.scene.enter('mainMenu');
        }
        // Handle other actions specific to this scene
        await ctx.answerCbQuery();
        await ctx.editMessageText(`You selected ${action} in ${section}`, Markup.inlineKeyboard([Markup.button.callback('Back', 'back_to_main_menu')]));
    });
    return scene;
}).filter(Boolean); // Remove null values

const stage = new Scenes.Stage([mainMenuScene, ...scenes]);

// Add a handler for /start command to enter the main menu
stage.command('start', (ctx) => {
    ctx.scene.enter('mainMenu');
});

// Add a handler for unexpected updates
stage.on('message', (ctx) => {
    ctx.reply('Please use the buttons to navigate.');
});

export { stage };
