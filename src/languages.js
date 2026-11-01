// The 10 languages Gnani Prisma transcribes, with one Timbre v2.5 voice each.
// Voice list: https://docs.gnani.ai/api/TTS/available-voices.md
export const LANGUAGES = {
  'hi-IN': { name: 'Hindi', native: 'हिन्दी', voice: 'Deepak' },
  'kn-IN': { name: 'Kannada', native: 'ಕನ್ನಡ', voice: 'Kavin' },
  'te-IN': { name: 'Telugu', native: 'తెలుగు', voice: 'Lavanya' },
  'ta-IN': { name: 'Tamil', native: 'தமிழ்', voice: 'Asmita' },
  'ml-IN': { name: 'Malayalam', native: 'മലയാളം', voice: 'Riyaan' },
  'mr-IN': { name: 'Marathi', native: 'मराठी', voice: 'Ishaan' },
  'bn-IN': { name: 'Bengali', native: 'বাংলা', voice: 'Dhruva' },
  'gu-IN': { name: 'Gujarati', native: 'ગુજરાતી', voice: 'Veera' },
  'pa-IN': { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', voice: 'Zayan' },
  'en-IN': { name: 'English', native: 'English', voice: 'Pranav' },
};

export const isLanguage = (code) => Object.hasOwn(LANGUAGES, code);
