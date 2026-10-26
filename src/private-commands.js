// Never feed private command text to chat, moderation logs, history or a host.
export const isPrivateCommand=text=>typeof text==='string'&&text.trimStart().startsWith('/');
