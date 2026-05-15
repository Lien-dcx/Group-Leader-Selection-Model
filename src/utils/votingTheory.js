// ============================================================
// votingTheory.js — Voting logic for VoteLeader
// ============================================================
// Implements:
//   1. Borda Count tallying
//   2. Projected Win Rate (from performance ratings)
//   3. Banzhaf Power Index classification (Dictator / Veto / Dummy)
// ============================================================

// ------------------------------------------------------------
// 1. BORDA COUNT
// In Borda Count with n candidates:
//   - 1st choice receives (n-1) points
//   - 2nd choice receives (n-2) points
//   - ...
//   - Last choice receives 0 points
//
// @param {Array} ballots   - array of ballot objects from DB
//   Each ballot: { voter_id, rankings: [{ candidate_id, rank }] }
// @param {Array} members   - array of member objects
// @returns {Array} members sorted by Borda score descending
// ------------------------------------------------------------
export function computebordaScores(ballots, members) {
  const n = members.length // total candidates per ballot

  // Initialize score map
  const scores = {}
  members.forEach(m => { scores[m.id] = 0 })

  ballots.forEach(ballot => {
    const rankings = ballot.rankings // [{ candidate_id, rank }]
    const numCandidates = rankings.length

    rankings.forEach(({ candidate_id, rank }) => {
      // rank 1 = top choice → gets (numCandidates - 1) points
      // rank n = last choice → gets 0 points
      const points = numCandidates - rank
      if (scores[candidate_id] !== undefined) {
        scores[candidate_id] += points
      }
    })
  })

  // Attach scores to members and sort
  const results = members.map(m => ({
    ...m,
    bordaScore: scores[m.id] || 0,
  }))

  results.sort((a, b) => b.bordaScore - a.bordaScore)

  // Assign final rank (ties share the same rank)
  let currentRank = 1
  results.forEach((m, i) => {
    if (i > 0 && m.bordaScore < results[i - 1].bordaScore) {
      currentRank = i + 1
    }
    m.finalRank = currentRank
  })

  return results
}

// ------------------------------------------------------------
// 2. PROJECTED WIN RATE
// Based on performance rating (1–10), normalized across all
// members so they sum to 100%.
//
// @param {Array} members - array of member objects
// @returns {Array} members with projectedWinRate (%) added
// ------------------------------------------------------------
export function computeProjectedWinRates(members) {
  const total = members.reduce((sum, m) => sum + m.performance_rating, 0)

  if (total === 0) {
    return members.map(m => ({ ...m, projectedWinRate: 0 }))
  }

  // Compute exact percentages scaled to 1 decimal place (i.e., work in tenths)
  const exact = members.map(m => (m.performance_rating / total) * 1000) // tenths of a percent
  const floored = exact.map(v => Math.floor(v))
  const remainders = exact.map((v, i) => ({ index: i, remainder: v - floored[i] }))

  // Total tenths allocated so far
  const totalFloored = floored.reduce((s, v) => s + v, 0)
  const leftover = 1000 - totalFloored // how many tenths remain to distribute

  // Give 1 tenth to the members with the largest remainders
  remainders
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, leftover)
    .forEach(({ index }) => { floored[index]++ })

  return members.map((m, i) => ({
    ...m,
    projectedWinRate: floored[i] / 10, // convert back to percent with 1 decimal
  }))
}

// ------------------------------------------------------------
// 3. GROUP SUCCESS SCORE
// Simple average of all performance ratings.
//
// @param {Array} members
// @returns {number} average rating (1 decimal)
// ------------------------------------------------------------
export function computeGroupSuccessScore(members) {
  if (!members.length) return 0
  const avg = members.reduce((sum, m) => sum + m.performance_rating, 0) / members.length
  return Math.round(avg * 10) / 10
}

// ------------------------------------------------------------
// 4. BANZHAF POWER INDEX — Classification
//
// The Banzhaf Power Index measures how often a voter is
// "pivotal" — i.e., their vote changes a losing coalition
// into a winning one (or vice versa).
//
// For classification purposes with Borda Count results:
//
//   DICTATOR: A member whose removal from any winning coalition
//     always makes it lose. Simplified: if removing the top
//     scorer causes every other coalition to fail to reach
//     the quota.
//
//   VETO PLAYER: A member who appears in EVERY winning
//     coalition but is not a dictator. They can block outcomes
//     but can't single-handedly decide them.
//
//   DUMMY: A member who never changes a coalition's outcome.
//     Their vote is never pivotal. Simplified: member whose
//     Borda score is 0.
//
// Implementation uses a simplified weighted voting model:
//   - Each member's "weight" = their Borda score
//   - Quota = 50% of total Borda points + 1 (simple majority)
//   - We enumerate coalitions (feasible for ≤ 10 members)
//
// @param {Array} scoredMembers - output of computebordaScores()
// @returns {Array} scoredMembers with powerRole added:
//   'dictator' | 'veto' | 'dummy' | 'regular'
// ------------------------------------------------------------
export function classifyPowerRoles(scoredMembers) {
  const n = scoredMembers.length
  if (n === 0) return scoredMembers

  const totalWeight = scoredMembers.reduce((s, m) => s + m.bordaScore, 0)

  // If all scores are 0, everyone is a dummy
  if (totalWeight === 0) {
    return scoredMembers.map(m => ({ ...m, powerRole: 'dummy' }))
  }

  // Quota: need strictly more than half
  const quota = Math.floor(totalWeight / 2) + 1

  // Count how many winning coalitions each member is pivotal in
  const pivotalCount = new Array(n).fill(0)
  const totalWinningCoalitions = { count: 0 }

  // Enumerate all 2^n subsets (feasible for n ≤ 10)
  const numSubsets = 1 << n
  for (let mask = 1; mask < numSubsets; mask++) {
    const coalitionWeight = scoredMembers.reduce((sum, m, i) => {
      return sum + ((mask >> i) & 1 ? m.bordaScore : 0)
    }, 0)

    if (coalitionWeight >= quota) {
      totalWinningCoalitions.count++
      // Check each member's pivotality
      scoredMembers.forEach((m, i) => {
        if ((mask >> i) & 1) {
          // Member i is in this coalition — check if removing them loses
          const withoutMember = coalitionWeight - m.bordaScore
          if (withoutMember < quota) {
            pivotalCount[i]++
          }
        }
      })
    }
  }

  const totalPivots = pivotalCount.reduce((s, c) => s + c, 0)

  return scoredMembers.map((m, i) => {
    const banzhafPower = totalPivots > 0
      ? Math.round((pivotalCount[i] / totalPivots) * 100 * 10) / 10
      : 0

    let powerRole = 'regular'

    if (m.bordaScore === 0) {
      // Zero Borda score → never pivotal → dummy
      powerRole = 'dummy'
    } else if (pivotalCount[i] === totalWinningCoalitions.count) {
      // Pivotal in EVERY winning coalition → dictator
      powerRole = 'dictator'
    } else if (pivotalCount[i] > 0) {
      // Is it a veto player? Check if every winning coalition includes them
      let isVeto = true
      for (let mask = 1; mask < numSubsets; mask++) {
        const coalitionWeight = scoredMembers.reduce((sum, mem, j) => {
          return sum + ((mask >> j) & 1 ? mem.bordaScore : 0)
        }, 0)
        if (coalitionWeight >= quota) {
          if (!((mask >> i) & 1)) {
            // This winning coalition does NOT include member i
            isVeto = false
            break
          }
        }
      }
      powerRole = isVeto ? 'veto' : 'regular'
    }

    return { ...m, banzhafPower, powerRole }
  })
}

// ------------------------------------------------------------
// 5. POWER ROLE DESCRIPTIONS
// Human-readable explanations for each role.
// ------------------------------------------------------------
export const powerRoleInfo = {
  dictator: {
    label: 'Dictator',
    color: '#F7C948',
    description:
      'This member is critical in every single winning outcome. No coalition can succeed without them — their vote alone determines the result.',
  },
  veto: {
    label: 'Veto Player',
    color: '#4F8EF7',
    description:
      'This member can block any decision but cannot decide alone. They appear in every winning coalition, giving them the power to veto outcomes.',
  },
  dummy: {
    label: 'Dummy',
    color: '#8B8FA8',
    description:
      'This member has zero influence on the outcome. No coalition changes its result based on whether they are included or not.',
  },
  regular: {
    label: 'Regular Voter',
    color: '#5DCAA5',
    description:
      'This member has standard voting power — influential in some coalitions but not universally pivotal.',
  },
}

// ------------------------------------------------------------
// 6. GENERATE ROOM CODE
// 6-character alphanumeric code (uppercase)
// ------------------------------------------------------------
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusing chars
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}