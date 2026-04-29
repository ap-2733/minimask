import { useMiniMask } from "./lib/useMiniMask.ts";

const PHONE_MASK = [
  "+1(",
  /\d/,
  /\d/,
  /\d/,
  ")",
  /\d/,
  /\d/,
  /\d/,
  "-",
  /\d/,
  /\d/,
  "-",
  /\d/,
  /\d/,
];
function App() {
  const [ref, getValue] = useMiniMask({
    mask: PHONE_MASK,
    initialValue: "1234567890",
  });

  return (
    <>
      <input
        style={{ fontFamily: "monospace" }}
        ref={ref}
        type="text"
        onBlur={() => console.log(getValue())}
      />
    </>
  );
}

export default App;
