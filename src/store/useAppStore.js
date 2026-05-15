import { create } from 'zustand'

const useAppStore = create((set) => ({
  // Current room
  room: null,
  setRoom: (room) => set({ room }),
  updateRoomStatus: (status) => set(state => ({
    room: state.room ? { ...state.room, status } : null,
  })),

  // Current user (member)
  currentMember: null,
  setCurrentMember: (member) => set({ currentMember: member }),

  // Members in room
  members: [],
  setMembers: (members) => set({ members }),
  addMember: (member) => set(state => ({ members: [...state.members, member] })),

  // Ballots
  ballots: [],
  setBallots: (ballots) => set({ ballots }),
  addBallot: (ballot) => set(state => ({ ballots: [...state.ballots, ballot] })),

  // Results
  results: null,
  setResults: (results) => set({ results }),

  // Reset everything
  reset: () => set({
    room: null,
    currentMember: null,
    members: [],
    ballots: [],
    results: null,
  }),
}))

export default useAppStore