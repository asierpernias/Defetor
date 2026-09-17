# Adaptative bot
A bot designed to play an iterated version of the Prisoner's Dilemma. This was made for a YSWS from Hackclub called [Defector](https://defector.hackclub.com/home). It combines pattern detection, probabilistic modeling and several classic heuristics (TFT, Generous Tit-for-Tat, punishment for unprovoked defection, etc) to decide whether to cooperate or defect each round.

## Signature

```js
esport default function bot({memory, history}) {...} 
```
- History - an array of previous rounds each shaped as `{ you: "C"|"D", opponent: "C"|"D"}`.
- Memory - persistent object across rounds, used in this case to accumulate statistics. Auto-initialized on the first call.
- Return value: [move, memory], where move is either "C" or "D".

If any unexpected error occurs, the bot falls back to safe mode and cooperates, preserving memory if exists.

## memory structure

#### Fields

- Rounds, copperations, defections: count of played rounds and opponent's moves.
- Model: Global transition matrix: How many times the opponent responded C/D given our last move. Used as a first order Markov chain.
- Recentmodel: Same as model but resets every 20 rounds, to capture behaviour changes.
- Markov2: Second order Markov chain that predicts opponents movement based on the pair (our_move, opponent_move) from the previous round.
- Patbuf: Circular buffer (max: 20 items) of the opponents last moves, used to detect periodic cycles.
- ConsecutiveD: Counter of consecutive mutual defections
- RecentWindow: Counter of rounds accumulated in recentModel before it resets.  
