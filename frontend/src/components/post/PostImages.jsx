import { cn } from "../../utils/cn";

function ImageTile({ src, index, onOpen, className }) {
  return (
    <button
      onClick={() => onOpen?.(index)}
      className={cn(
        "group relative overflow-hidden rounded-xl2 bg-surface-light dark:bg-white/5 block w-full h-full",
        className
      )}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </button>
  );
}

// Handles the four documented layouts: 1 large image, a balanced 2-column
// pair, "one large + two small" for three images, and a 2x2 grid with a
// "+N more" overlay once there are more than four.
export default function PostImages({ images = [], onOpen }) {
  if (!images.length) return null;
  const count = images.length;

  if (count === 1) {
    return (
      <div className="rounded-xl2 overflow-hidden max-h-[520px]">
        <ImageTile src={images[0]} index={0} onOpen={onOpen} className="max-h-[520px] aspect-[4/3]" />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-1.5 h-72 sm:h-80">
        <ImageTile src={images[0]} index={0} onOpen={onOpen} />
        <ImageTile src={images[1]} index={1} onOpen={onOpen} />
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-1.5 h-72 sm:h-80">
        <ImageTile src={images[0]} index={0} onOpen={onOpen} className="row-span-2" />
        <ImageTile src={images[1]} index={1} onOpen={onOpen} />
        <ImageTile src={images[2]} index={2} onOpen={onOpen} />
      </div>
    );
  }

  // 4 or more
  const extra = count - 4;
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1.5 h-72 sm:h-80">
      <ImageTile src={images[0]} index={0} onOpen={onOpen} />
      <ImageTile src={images[1]} index={1} onOpen={onOpen} />
      <ImageTile src={images[2]} index={2} onOpen={onOpen} />
      <div className="relative">
        <ImageTile src={images[3]} index={3} onOpen={onOpen} />
        {extra > 0 && (
          <div
            onClick={() => onOpen?.(3)}
            className="absolute inset-0 rounded-xl2 bg-ink/55 flex items-center justify-center cursor-pointer"
          >
            <span className="text-white font-display font-bold text-lg">+{extra} more</span>
          </div>
        )}
      </div>
    </div>
  );
}
