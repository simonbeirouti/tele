import { Scenes } from 'telegraf';
import { getInlineKeyboard, getNavigationText, navigationMap } from './getInlineKeyboard.js';

const createMainMenuScene = () => {
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
        await ctx.editMessageText(`You selected ${action} in the main menu`, {
            reply_markup: {
                inline_keyboard: [[{ text: 'Back to Main Menu', callback_data: 'back_to_main_menu' }]]
            }
        });
    });

    return mainMenuScene;
};

const createScenes = () => {
    return Object.keys(navigationMap).map(section => {
        if (section === 'main') return null;

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
            await ctx.answerCbQuery();
            await ctx.editMessageText(`You selected ${action} in ${section}`, {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Back', callback_data: 'back_to_main_menu' }]]
                }
            });
        });
        return scene;
    }).filter(Boolean);
};

const createStage = () => {
    const mainMenuScene = createMainMenuScene();
    const scenes = createScenes();
    const stage = new Scenes.Stage([mainMenuScene, ...scenes]);

    stage.command('start', (ctx) => {
        ctx.scene.enter('mainMenu');
    });

    stage.on('text', (ctx) => {
        if (!ctx.message.text.startsWith('/')) {
            ctx.reply('Please use the buttons to navigate or use a valid command.');
        }
    });

    return stage;
};

export { createStage };
