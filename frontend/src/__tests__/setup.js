import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia — ThemeContext and useMediaQuery both
// call it during initial render, so stub it out for the test environment.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom doesn't implement scrollTo used by "scroll-behavior: smooth" links
window.scrollTo = () => {};

// jsdom doesn't implement scrollIntoView at all (used by the message
// thread's auto-scroll-to-latest behavior).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
