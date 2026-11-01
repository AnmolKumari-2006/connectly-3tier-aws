// Insert `text` into an <input>/<textarea> at the caret (replacing any
// selection) and return the new value plus where the caret should land.
export function insertAtCursor(element, currentValue, text) {
  const start = element?.selectionStart ?? currentValue.length;
  const end = element?.selectionEnd ?? start;
  return {
    value: currentValue.slice(0, start) + text + currentValue.slice(end),
    caret: start + text.length,
  };
}
