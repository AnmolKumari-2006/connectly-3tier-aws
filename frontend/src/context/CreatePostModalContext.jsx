import { createContext, useContext, useRef, useState } from "react";

const CreatePostModalContext = createContext(null);

export function CreatePostModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  // Holds an optional callback for "who asked to open this" — e.g. a
  // profile page wants to prepend the new post to its own local list,
  // not just the global home feed. Stored in a ref since it's a plain
  // function reference, not something that needs to trigger a re-render.
  const onCreatedRef = useRef(null);

  const openModal = (onCreated) => {
    onCreatedRef.current = onCreated || null;
    setOpen(true);
  };

  const closeModal = () => setOpen(false);

  const notifyCreated = (post) => {
    onCreatedRef.current?.(post);
  };

  return (
    <CreatePostModalContext.Provider value={{ open, openModal, closeModal, notifyCreated }}>
      {children}
    </CreatePostModalContext.Provider>
  );
}

export function useCreatePostModal() {
  const ctx = useContext(CreatePostModalContext);
  if (!ctx) throw new Error("useCreatePostModal must be used within a CreatePostModalProvider");
  return ctx;
}
