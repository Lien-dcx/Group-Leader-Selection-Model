import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Persisted to sessionStorage so a page refresh doesn't kick you out
export const useAppStore = create(
  persist(
    (set) => ({
      // Current room the user is in
      room: null,          // { id, code, name, creator_name, creator_member_id, status }
      setRoom: (room) => set({ room }),
      updateRoomStatus: (status) => set(state => ({
        room: state.room ? { ...state.room, status } : null,
      })),

      // The current user's member record
      currentMember: null, // { id, room_id, member_no, full_name, ... }
      setCurrentMember: (member) => set({ 
        currentMember: member,
        isCreator: member?.is_creator ?? false, }),

      // Whether the current user is the room creator
      isCreator: false,
      setIsCreator: (val) => set({ isCreator: val }),
      
      // Clear everything on exit
      clearSession: () => set({ room: null, currentMember: null, isCreator: false }),
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