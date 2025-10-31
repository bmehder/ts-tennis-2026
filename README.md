# 🎾 TS Tennis 2026  
*A developer’s eleventh attempt at purity.*

---

## 🧩 Introduction

This project began as a simple tennis scoring app more than ten years ago.  
Each year, I rebuild it from scratch — not because it’s broken, but because *I am*.  
Or rather, because I’m still refining how I think about **clarity, state, and architecture**.

**TS Tennis 2026** is this year’s attempt: a clean, functional rewrite powered by  
**TypeScript**, **Zod**, and **The Elm Architecture** — a trinity of static safety, runtime validation, and pure state transitions.

---

## ☕ Why This Exists

Every developer has a sandbox — a place to return and test what they’ve learned.  
For me, tennis scoring is perfect: it’s rule-based, hierarchical, and filled with edge cases.  
It’s deterministic but surprisingly rich — a perfect playground for **functional programming**.

The goal this year wasn’t to *add features*, but to *remove friction*.  
To see if I could build something that feels natural, readable, and mathematically sound —  
where every state transition can be reasoned about like a small proof.

---

## 🧠 Architectural Notes

This app follows **The Elm Architecture (TEA)** — or at least, my flavor of it.  
It’s a minimalist TEA: there’s a **Model**, a **Msg**, and an **update** function.

```ts
type Msg =
  | { kind: 'PointScored'; player: Player }
  | { kind: 'NewGame' }
  | { kind: 'NewSet' }

function update(state: MatchState, msg: Msg): MatchState
```

Every click in the UI dispatches a message, and the system evolves one step at a time.  
No side effects. No mutation. No mysteries.

The structure feels comforting — a cycle of predictability,  
like watching two players trade forehands until one breaks through.

---

## 🧩 TypeScript + Zod: A Dual Safety Net

TypeScript gives **static safety** — a compiler-enforced promise that your logic covers all possible states.  
Zod adds **runtime safety** — protection against bad data creeping in through persistence or user input.

Together, they create a **belt-and-suspenders** architecture.

```ts
const MatchStateSchema = z.object({
  sets: z.array(z.tuple([z.number(), z.number()])),
  currentSet: z.number(),
  currentGame: z.union([
    z.object({ kind: z.literal('Normal'), player1Point: z.string(), player2Point: z.string() }),
    z.object({ kind: z.literal('Deuce') }),
    z.object({ kind: z.literal('Advantage'), playerAtAdvantage: z.string() }),
    z.object({ kind: z.literal('GameOver'), gameWinner: z.string() }),
  ])
})
```

I don’t always validate runtime data, but when I do, it’s through **Zod**.

---

## 🧮 Modeling the Game

Each layer is pure and self-contained:

| Level | Purpose |
|-------|----------|
| **Game** | Handles points (LOVE → FIFTEEN → THIRTY → FORTY → Game) |
| **Set** | Aggregates games; win-by-two or goes to tiebreak |
| **Match** | Best of three; declares the match winner |

Everything is modeled with **discriminated unions**, not boolean flags.  
That means instead of saying `isOver: true`, the state itself says:

```ts
{ kind: 'GameOver', gameWinner: 'Player1' }
```

There’s something beautiful about that.  
You never check for “over-ness” — you just *pattern match* on what kind of thing you have.

---

## 🧩 Example Flow

```ts
matchState = update(matchState, { kind: 'PointScored', player: 'Player1' })
```

That’s it.  
Svelte reactivity takes care of the rest.

When the tiebreak ends, the next set starts automatically.  
When the match ends, no more updates are accepted.  
It’s a small but elegant dance — and after all these years, it finally feels smooth.

---

## 🧱 Example Match State

```json
{
  "kind": "InProgress",
  "sets": [
    [7, 6],
    [6, 0],
    [0, 0]
  ],
  "currentGame": {
    "kind": "Normal",
    "player1Point": "THIRTY",
    "player2Point": "FIFTEEN"
  },
  "currentSet": 3
}
```

---

## ⚙️ Dev Notes

```bash
# Run dev server
npm run dev

# Build
npx tsc

# Run tests
npx vitest
```

---

## 🧗‍♂️ Lessons Learned

- You can make *The Elm Architecture* work anywhere, even in a tennis app.  
- TypeScript is better when you stop fighting it and start listening to it.  
- A tiebreaker is a great metaphor for software — both are all about control under pressure.  

---

## 🚀 Roadmap

- [x] Normal game scoring  
- [x] Deuce / Advantage  
- [x] Set tracking  
- [x] Tiebreaks (first to 7, win by 2)  
- [x] Match orchestration (best of 3)  
- [ ] Reactive Svelte UI  
- [ ] Persistence (localStorage)  
- [ ] Replay system  

---

## 🧬 Technical Deep Dive

This section is for the curious — the ones who want to know *why* it works.

### 1. Immutable State

All transitions are pure.  
Each function — `scorePoint`, `scoreGame`, `scoreSet`, `scoreMatch` — accepts a state and returns a new one.  
There are no mutations, ever. Even `nextGameState` creates a fresh structure.

```ts
export const scorePoint = (state: MatchState, player: Player): MatchState => {
  const newGame = scoreGame(state.currentGame, player)
  const newSets = [...state.sets]
  // orchestration happens here — sets, games, match over
  return { ...state, currentGame: newGame, sets: newSets }
}
```

---

### 2. Pattern Matching

Using CanaryJS’s `match` function:

```ts
export const match = (state, cases) => {
  const handler = cases[state.kind] || cases._
  if (!handler) throw new Error(`No handler for kind: ${state.kind}`)
  return handler(state)
}
```

This allows functional branching without `switch` or `if` clutter:

```ts
match(game, {
  Normal: handleNormal,
  Deuce: handleDeuce,
  Advantage: handleAdvantage,
  GameOver: () => game
})
```

It’s elegant and composable — logic reads like a decision tree, not an algorithm.

---

### 3. The Tiebreak

The tiebreak is treated as its own `Game` variant:

```ts
{ kind: 'Tiebreak', p1Points: number, p2Points: number }
```

Rules:
- First to 7, must win by 2  
- Once complete, the set becomes `{ kind: 'SetOver' }`  
- The match then orchestrates the next set or declares the winner  

It’s a subtle addition but a massive simplification compared to previous years.

---

### 4. The Elm Loop

The `update` function is pure and central —  
a simple switchboard that connects player actions to state transformations:

```ts
export const update = (state: MatchState, msg: Msg): MatchState =>
  match(msg, {
    PointScored: ({ player }) => scorePoint(state, player),
    NewGame: () => newGame(state),
    NewSet: () => newSet(state),
    _: () => state
  })
```

Svelte’s reactivity handles rendering; `update()` handles truth.

---

## 💭 Closing Thought

> “Every rebuild is a rematch with my past self.”

The joy isn’t in finishing — it’s in *refining*.  
And this version — **TS Tennis 2026** — finally feels like a rally worth watching.
# ts-tennis-2026
