import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAppStore = create(
  persist(
    (set) => ({
      // Current room
      room: null,
      setRoom: (room) => set({ room }),
      updateRoomStatus: (status) => set(state => ({
        room: state.room ? { ...state.room, status } : null,
      })),

      // Current user (member)
      currentMember: null,
      setCurrentMember: (member) => set({
        currentMember: member,
        isCreator: member?.is_creator ?? false,
      }),

      // isCreator (PreVote.jsx reads this directly from store)
      isCreator: false,
      setIsCreator: (val) => set({ isCreator: val }),

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
        isCreator: false,
        members: [],
        ballots: [],
        results: null,
      }),
    }),
    {
      name: 'voteleader-session',
      storage: {
        getItem: (key) => {
          const val = sessionStorage.getItem(key)
          return val ? JSON.parse(val) : null
        },
        setItem: (key, val) => sessionStorage.setItem(key, JSON.stringify(val)),
        removeItem: (key) => sessionStorage.removeItem(key),
      },
    }
  )
)

export default useAppStore