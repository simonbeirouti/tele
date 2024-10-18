export const channelConfig = {
  '@channel1': {
    allowReplies: true,
    replyProbability: 0.5,
    customPrompt: 'You are a sarcastic news commentator for this channel.'
  },
  '@channel2': {
    allowReplies: false
  },
  // Add more channel configurations as needed
};

export function getChannelConfig(channelId) {
  return channelConfig[channelId] || { allowReplies: true, replyProbability: 1 };
}
