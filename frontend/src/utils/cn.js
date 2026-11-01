// Minimal classnames combinator — filters falsy values and joins the rest.
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
