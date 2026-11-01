import { chime } from '../wav.js';

// Stand-ins for the paid services so the whole app can be built and load
// tested for free. They pretend to take as long as the real APIs do.
//
// Mock "speech" walks through a short pickup conversation, and mock
// "translation" looks the sentence up in the table below, so the demo
// reads like a real exchange.
const CONVERSATION = [
  {
    'en-IN': "I'm standing near gate number 2, wearing a blue shirt.",
    'hi-IN': 'मैं गेट नंबर 2 के पास खड़ी हूँ, नीली शर्ट पहनी है।',
    'kn-IN': 'ನಾನು ಗೇಟ್ ನಂಬರ್ 2 ಹತ್ತಿರ ನಿಂತಿದ್ದೀನಿ, ನೀಲಿ ಶರ್ಟ್ ಹಾಕಿದ್ದೀನಿ.',
    'te-IN': 'నేను గేట్ నంబర్ 2 దగ్గర నిలబడి ఉన్నాను, నీలం షర్ట్ వేసుకున్నాను.',
    'ta-IN': 'நான் கேட் நம்பர் 2 பக்கத்துல நிக்கறேன், நீல ஷர்ட் போட்டிருக்கேன்.',
  },
  {
    'en-IN': "I'll be there in 2 minutes.",
    'hi-IN': 'मैं 2 मिनट में पहुँच रहा हूँ।',
    'kn-IN': 'ನಾನು 2 ನಿಮಿಷದಲ್ಲಿ ಬರ್ತೀನಿ.',
    'te-IN': 'నేను 2 నిమిషాల్లో వస్తాను.',
    'ta-IN': 'நான் 2 நிமிஷத்துல வந்துடுவேன்.',
  },
  {
    'en-IN': 'Please come to the other side of the road, near Sharma Sweets.',
    'hi-IN': 'प्लीज़ सड़क के दूसरी तरफ़ आ जाइए, शर्मा स्वीट्स के पास।',
    'kn-IN': 'ದಯವಿಟ್ಟು ರಸ್ತೆಯ ಆ ಕಡೆ ಬನ್ನಿ, ಶರ್ಮಾ ಸ್ವೀಟ್ಸ್ ಹತ್ತಿರ.',
    'te-IN': 'దయచేసి రోడ్డు అవతలి వైపు రండి, శర్మ స్వీట్స్ దగ్గర.',
    'ta-IN': 'தயவுசெய்து ரோட்டோட அந்தப் பக்கம் வாங்க, ஷர்மா ஸ்வீட்ஸ் பக்கத்துல.',
  },
  {
    'en-IN': 'OK, I can see you now. Coming.',
    'hi-IN': 'ठीक है, आप दिख रही हैं। आ रहा हूँ।',
    'kn-IN': 'ಸರಿ, ನೀವು ಕಾಣಿಸ್ತಿದ್ದೀರಾ. ಬರ್ತಿದ್ದೀನಿ.',
    'te-IN': 'సరే, మీరు కనిపిస్తున్నారు. వస్తున్నాను.',
    'ta-IN': 'சரி, நீங்க தெரியறீங்க. வந்துட்டே இருக்கேன்.',
  },
];

// Quick-chat buttons send fixed English sentences (see public/quick-chat.js).
const QUICK_REPLIES = [
  {
    'en-IN': 'Are you coming?',
    'hi-IN': 'आप आ रहे हैं?',
    'kn-IN': 'ನೀವು ಬರ್ತಿದ್ದೀರಾ?',
    'te-IN': 'మీరు వస్తున్నారా?',
    'ta-IN': 'நீங்க வர்றீங்களா?',
  },
  {
    'en-IN': "I'm waiting at the pickup point.",
    'hi-IN': 'मैं पिकअप पॉइंट पर इंतज़ार कर रही हूँ।',
    'kn-IN': 'ನಾನು ಪಿಕಪ್ ಪಾಯಿಂಟ್‌ನಲ್ಲಿ ಕಾಯ್ತಿದ್ದೀನಿ.',
    'te-IN': 'నేను పికప్ పాయింట్ దగ్గర వెయిట్ చేస్తున్నాను.',
    'ta-IN': 'நான் பிக்கப் பாயிண்ட்ல வெயிட் பண்றேன்.',
  },
  {
    'en-IN': 'My location is the same as on the map.',
    'hi-IN': 'मेरी लोकेशन मैप के हिसाब से ही है।',
    'kn-IN': 'ನನ್ನ ಲೊಕೇಶನ್ ಮ್ಯಾಪ್‌ನಲ್ಲಿ ಇರೋ ಹಾಗೇ ಇದೆ.',
    'te-IN': 'నా లొకేషన్ మ్యాప్‌లో ఉన్నట్టే ఉంది.',
    'ta-IN': 'என் லொகேஷன் மேப்ல இருக்கற மாதிரியே தான்.',
  },
  {
    'en-IN': 'Message me when you reach.',
    'hi-IN': 'पहुँचकर मैसेज कर दीजिए।',
    'kn-IN': 'ತಲುಪಿದ ಮೇಲೆ ಮೆಸೇಜ್ ಮಾಡಿ.',
    'te-IN': 'చేరుకున్నాక మెసేజ్ చేయండి.',
    'ta-IN': 'வந்ததும் மெசேஜ் பண்ணுங்க.',
  },
  {
    'en-IN': "I'm on my way.",
    'hi-IN': 'मैं रास्ते में हूँ, आ रहा हूँ।',
    'kn-IN': 'ದಾರಿಯಲ್ಲಿದ್ದೀನಿ, ಬರ್ತಿದ್ದೀನಿ.',
    'te-IN': 'దారిలో ఉన్నాను, వస్తున్నాను.',
    'ta-IN': 'வழியில இருக்கேன், வந்துட்டு இருக்கேன்.',
  },
  {
    'en-IN': "I've reached the pickup point.",
    'hi-IN': 'मैं पिकअप पॉइंट पर पहुँच गया हूँ।',
    'kn-IN': 'ನಾನು ಪಿಕಪ್ ಪಾಯಿಂಟ್‌ಗೆ ಬಂದಿದ್ದೀನಿ.',
    'te-IN': 'నేను పికప్ పాయింట్‌కి వచ్చేశాను.',
    'ta-IN': 'நான் பிக்கப் பாயிண்ட்டுக்கு வந்துட்டேன்.',
  },
  {
    'en-IN': 'Please come to the main road.',
    'hi-IN': 'प्लीज़ मेन रोड पर आ जाइए।',
    'kn-IN': 'ದಯವಿಟ್ಟು ಮೇನ್ ರೋಡ್‌ಗೆ ಬನ್ನಿ.',
    'te-IN': 'దయచేసి మెయిన్ రోడ్‌కి రండి.',
    'ta-IN': 'தயவுசெய்து மெயின் ரோட்டுக்கு வாங்க.',
  },
  {
    'en-IN': 'Stuck in traffic, 5 more minutes.',
    'hi-IN': 'ट्रैफ़िक में फँसा हूँ, 5 मिनट और लगेंगे।',
    'kn-IN': 'ಟ್ರಾಫಿಕ್‌ನಲ್ಲಿ ಸಿಕ್ಕಿಕೊಂಡಿದ್ದೀನಿ, ಇನ್ನೂ 5 ನಿಮಿಷ.',
    'te-IN': 'ట్రాఫిక్‌లో ఇరుక్కున్నాను, ఇంకా 5 నిమిషాలు.',
    'ta-IN': 'டிராபிக்ல மாட்டிக்கிட்டேன், இன்னும் 5 நிமிஷம்.',
  },
];

let turn = 0;
const wait = (min, max) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

export async function transcribe(_audio, lang) {
  await wait(150, 350);
  const line = CONVERSATION[turn++ % CONVERSATION.length];
  return line[lang] ?? line['en-IN'];
}

export async function translate(text, fromLang, toLang) {
  await wait(250, 500);
  const line = [...CONVERSATION, ...QUICK_REPLIES].find((l) => l[fromLang] === text);
  return line?.[toLang] ?? `[${toLang}] ${text}`;
}

export async function speak(_text, _lang) {
  await wait(200, 400);
  return chime();
}
