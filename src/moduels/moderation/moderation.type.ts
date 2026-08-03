export enum ModerationCategory {
  SEXUAL = 'sexual',
  SEXUAL_MINORS = 'sexual/minors',
  HATE = 'hate',
  HATE_THREATENING = 'hate/threatening',
  HARASSMENT = 'harassment',
  HARASSMENT_THREATENING = 'harassment/threatening',
  SELF_HARM = 'self-harm',
  SELF_HARM_INTENT = 'self-harm/intent',
  SELF_HARM_INSTRUCTIONS = 'self-harm/instructions',
  VIOLENCE = 'violence',
  VIOLENCE_GRAPHIC = 'violence/graphic',
}
 
export enum ModerationSourceModule {
  RAG = 'RAG',
  CHAT = 'CHAT',
}