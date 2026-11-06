# Maatu: voice notes that arrive in the other person's language

**Code:** [github.com/Silmiya282828/maatu-gnani-ai](https://github.com/Silmiya282828/maatu-gnani-ai) · Built for the Great Indian AI Internship Challenge

## The problem

When I'm rushing to college or work and my ride is close by, I don't want to stop and type "I'm at metro gate 2". Calling is harder still when the driver and I don't share a language, because I end up focusing on the words instead of finding him. On his side, a rider can't read a chat on a moving bike.

A voice note is the easiest thing in that moment: keep walking, say where you are, in your own language. But today it only helps if the other person understands it.

## The solution

**Maatu** (ಮಾತು, Kannada for "the spoken word") translates voice notes between the customer and the rider.

- The customer speaks in her language. The rider hears it **out loud in his**, so he never reads while riding.
- He replies with **one tap** ("On my way"), and she hears it in hers.
- Both of them also see the text in their own language, with the original underneath.

It's a small thing, but a smoother pickup makes the whole trip less stressful, especially for people on a deadline.

## How it works

Maatu is an **API that ride and delivery apps plug in**, not another app. The app keeps its own chat and sends each voice note to one endpoint.

1. **Gnani Prisma** turns speech into text. v3 also detects which language was actually spoken, so a Kannada speaker who switches to English is still translated correctly.
2. **Sarvam Mayura** translates it, keeping words like "metro gate 2" as they are.
3. **Gnani Timbre** speaks the translation in the listener's language.

It works in **10 Indian languages**.

## Built to be used for real

- **Never loses a message:** if a step fails, the listener still gets the best version available, down to the original voice note.
- **Cheap at scale:** quick replies and translations are cached, so a common phrase is paid for once.
- **Ready for traffic:** stateless, with a queue per AI service, and load-tested against mock providers.
- **Safe:** curse words are starred in the text and left out of the speech.

## What's next

Integration with a real ride app, voice notes that queue offline on bad networks, and help from native speakers to tune each language.

I'd love to see this, or something like it, inside Rapido or Namma Yatri.
