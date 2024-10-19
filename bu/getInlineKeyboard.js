import {Markup} from "telegraf";

export const navigationMap = {
	main: {
		text: "Main Menu",
		buttons: [
			["meme trade", "meme swaps"],
			["new tokens", "new pools"],
			["burrow", "price"],
			["token info", "account info"],
			["Invite Friends"],
			["Join our telegram group"],
		],
	},
	nft_trades: {
		text: "NFT Trades",
		buttons: [
			["Invite Friends"],
			["Join our telegram group"],
		],
	},
	ft_swaps: {
		text: "FT Swaps",
		buttons: [
			["Invite Friends"],
			["Join our telegram group"],
		],
	},
};

export function getInlineKeyboard(section = "main") {
	const navSection = navigationMap[section];
	if (!navSection) {
		console.error(`Navigation section "${section}" not found`);
		return Markup.inlineKeyboard([]);
	}

	const keyboard = navSection.buttons.map((row) =>
		row.map((button) => {
			const callbackData = button.toLowerCase().replace(/\s+/g, "_");
			return Markup.button.callback(button, callbackData);
		})
	);

	if (section !== "main") {
		keyboard.push([
			Markup.button.callback("Back to Main Menu", "back_to_main_menu"),
		]);
	}

	return Markup.inlineKeyboard(keyboard);
}

export function getNavigationText(section = "main") {
	return navigationMap[section]?.text || "Menu";
}
