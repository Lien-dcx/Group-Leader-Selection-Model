// ============================================================
// votingTheory.js — Voting logic for VoteLeader
// ============================================================

export function computeBordaScores(ballots, members) {
  const scores = {}
  members.forEach(m => { scores[m.id] = 0 })

  ballots.forEach(ballot => {
    const rankings = ballot.rankings
    const numCandidates = rankings.length
    rankings.forEach(({ candidate_id, rank }) => {
      const points = numCandidates - rank
      if (scores[candidate_id] !== undefined) {
        scores[candidate_id] += points
      }
    })
  })

  const results = members.map(m => ({
    ...m,
    borda_score: scores[m.id] || 0,   // FIX: was bordaScore
  }))

  results.sort((a, b) => b.borda_score - a.borda_score)

  let currentRank = 1
  results.forEach((m, i) => {
    if (i > 0 && m.borda_score < results[i - 1].borda_score) {
      currentRank = i + 1
    }
    m.finalRank = currentRank
  })

  return results
}

export function computeProjectedWinRates(members) {
  const total = members.reduce((sum, m) => sum + m.performance_rating, 0)
  return members.map(m => ({
    ...m,
    win_rate: total > 0                // FIX: was projectedWinRate
      ? Math.round((m.performance_rating / total) * 100 * 10) / 10
      : 0,
  }))
}

export function computeGroupSuccessScore(members) {
  if (!members.length) return 0
  const avg = members.reduce((sum, m) => sum + m.performance_rating, 0) / members.length
  return Math.round(avg * 10) / 10
}

export function classifyPowerRoles(scoredMembers) {
  const n = scoredMembers.length
  if (n === 0) return scoredMembers

  const totalWeight = scoredMembers.reduce((s, m) => s + m.borda_score, 0)  // FIX: was bordaScore

  if (totalWeight === 0) {
    return scoredMembers.map(m => ({ ...m, powerRole: 'dummy' }))
  }

  const quota = Math.floor(totalWeight / 2) + 1
  const pivotalCount = new Array(n).fill(0)
  const totalWinningCoalitions = { count: 0 }

  const numSubsets = 1 << n
  for (let mask = 1; mask < numSubsets; mask++) {
    const coalitionWeight = scoredMembers.reduce((sum, m, i) => {
      return sum + ((mask >> i) & 1 ? m.borda_score : 0)  // FIX: was bordaScore
    }, 0)

    if (coalitionWeight >= quota) {
      totalWinningCoalitions.count++
      scoredMembers.forEach((m, i) => {
        if ((mask >> i) & 1) {
          const withoutMember = coalitionWeight - m.borda_score  // FIX: was bordaScore
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

    if (m.borda_score === 0) {       // FIX: was bordaScore
      powerRole = 'dummy'
    } else if (pivotalCount[i] === totalWinningCoalitions.count) {
      powerRole = 'dictator'
    } else if (pivotalCount[i] > 0) {
      let isVeto = true
      for (let mask = 1; mask < numSubsets; mask++) {
        const coalitionWeight = scoredMembers.reduce((sum, mem, j) => {
          return sum + ((mask >> j) & 1 ? mem.borda_score : 0)  // FIX: was bordaScore
        }, 0)
        if (coalitionWeight >= quota) {
          if (!((mask >> i) & 1)) {
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

export const powerRoleInfo = {
  dictator: {
    label: 'Dictator',
    color: '#F7C948',
    description: 'This member is critical in every single winning outcome. No coalition can succeed without them.',
  },
  veto: {
    label: 'Veto Player',
    color: '#4F8EF7',
    description: 'This member can block any decision but cannot decide alone.',
  },
  dummy: {
    label: 'Dummy',
    color: '#8B8FA8',
    description: 'This member has zero influence on the outcome.',
  },
  regular: {
    label: 'Regular Voter',
    color: '#5DCAA5',
    description: 'This member has standard voting power.',
  },
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}