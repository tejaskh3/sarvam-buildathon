/* ------------------------------------------------------------------
   Everything on the page reads from here.
   Written from the point of view of the people using Yaadein — not the
   system behind it.
   ------------------------------------------------------------------ */

export const personas = [
  {
    name: 'Kamala',
    age: 78,
    role: 'The person talking',
    blurb:
      'Lives with early memory loss. Speaks Marathi with Hindi and English mixed in. Hard of hearing. Never touches a screen — this is voice, and only voice.',
    initials: 'क',
    tone: 'warm',
  },
  {
    name: 'Meena',
    age: 49,
    role: 'Daughter · lives away',
    blurb:
      'In another city, visits once a fortnight. Carries the guilt of distance, and has no real sense of how things are going day to day.',
    initials: 'मी',
    tone: 'indigo',
  },
  {
    name: 'Arjun',
    age: 22,
    role: 'Grandson · visits',
    blurb:
      'Loves his Aaji. Dreads the visits, because he never knows what to say and the silence is unbearable.',
    initials: 'अ',
    tone: 'green',
  },
  {
    name: 'Latha',
    age: 34,
    role: 'Coordinator at the day-care centre',
    blurb:
      'Forty residents. About ten hours a week for one-to-one time. Wants everyone to get a real conversation, not just the six she can prepare for.',
    initials: 'ल',
    tone: 'rose',
  },
] as const

/* ---------------------------------------------------------- the loop */

export const loop = [
  {
    step: 'It asks',
    line: '“What should I call you? And where do you live?”',
    body: 'One question at a time, in whichever language they answer in. Nothing to read, nothing to tap — just a voice, and time to think.',
  },
  {
    step: 'It remembers',
    line: 'Kamala. Pune. Kothrud.',
    body: 'Every answer is kept, along with the small things around it: who they went with, what the weather was, what they laughed about.',
  },
  {
    step: 'It comes back',
    line: '“You mentioned you live in Pune — what do you like about Pune?”',
    body: 'The next conversation opens where the last one left off. Never a blank page. Never “so, what would you like to talk about?”',
  },
  {
    step: 'It notices',
    line: 'Did they remember Pune today?',
    body: 'Quietly recorded for the family. Never spoken aloud, never scored, never corrected. A forgotten answer is simply given back, warmly.',
  },
]

/* --------------------------------------------------- the experience */

export const principles = [
  {
    title: 'One orb. Nothing else.',
    body: 'No menus, no buttons, no language picker. Tap once and talk. The orb listens, thinks and speaks — and you can always tell which, at a glance.',
  },
  {
    title: 'It waits.',
    body: 'When someone trails off mid-sentence hunting for a word, it holds the silence instead of jumping in. Finishing a thought is the whole point.',
  },
  {
    title: 'It never leaves a gap.',
    body: 'A quick “achha…” lands the moment they stop speaking, so nobody sits wondering whether the thing is broken and repeats themselves.',
  },
  {
    title: 'It never tests.',
    body: 'If a name won’t come, it gives the name. No hints, no “take your time”, no correcting a wrong answer. Nobody is put in a moment of failure.',
  },
  {
    title: 'It follows, not leads.',
    body: 'The moment they start talking about something else, that becomes the conversation. The old thread is saved for next time.',
  },
  {
    title: 'It speaks their language.',
    body: 'Hindi, English, Marathi, or all three in one sentence — the way people actually talk at home. No one has to choose.',
  },
]

/* --------------------------------------------- what the family gets */

export const outputs = [
  {
    who: 'Arjun',
    what: 'What to talk about on Sunday',
    lines: [
      'Ask about: Sunday walks in Sarasbaug',
      'Wants to finish: the story about the blue scooter',
      'Maybe not today: Ajoba’s illness — it upset her on Tuesday',
      'New this week: she used to make mango pickle every summer',
    ],
    foot: 'Reads in under a minute, in the car on the way over. Nobody has to sit in silence again.',
  },
  {
    who: 'Meena',
    what: 'Something you didn’t know',
    lines: [
      '“I used to go to Sarasbaug every Sunday with your father.”',
      'First time she’s mentioned it · Thursday',
      'Play the recording in her own voice',
    ],
    foot: 'Not a monitoring dashboard. A reason to call, and something new to ask about.',
  },
  {
    who: 'Latha',
    what: 'Who needs you today',
    lines: [
      '34 residents had a conversation yesterday',
      '2 worth a look: one seemed low, one got upset',
      '1 question for a family to settle',
    ],
    foot: 'The good days need nothing from her. Only the two that matter come up.',
  },
]
