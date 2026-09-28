// Run against an open Chromium test page: node tests/mini-dotan-drag.browser.mjs <CDP websocket URL>
import assert from "node:assert/strict";
const socket = new WebSocket(process.argv[2]);
await new Promise((resolve) =>
  socket.addEventListener("open", resolve, { once: true }),
);
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const { targetInfos } = await send("Target.getTargets");
  const target = targetInfos.find(
    (target) =>
      target.type === "page" && target.url.startsWith("http://localhost:3009"),
  );
  assert.ok(target, "Open the local preview first");
  const { sessionId } = await send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true,
  });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => {
    const result = await page("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await page("Emulation.setDeviceMetricsOverride", {
    width: 393,
    height: 852,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page("Emulation.setTouchEmulationEnabled", { enabled: true });
  await evaluate(
    "['quiet','left','hidden'].forEach(key=>localStorage.removeItem('mini-dotan-'+key))",
  );
  await page("Page.reload");
  await wait(1500);
  const pet =
    'document.querySelector("button[aria-label=\\"Contact Dotan\\"]")';
  const dock = 'document.querySelector("[data-mini-dotan]")';
  const touch = (type, x, y) =>
    page("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y, id: 1 }],
    });
  const center = async () =>
    evaluate(
      `(()=>{const r=${pet}.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
    );
  const dragTo = async (x, y, row, end = "touchEnd") => {
    const start = await center();
    const scroll = await evaluate("scrollY");
    await touch("touchStart", start.x, start.y);
    for (let i = 1; i <= 12; i++) {
      await touch(
        "touchMove",
        start.x + ((x - start.x) * i) / 12,
        start.y + ((y - start.y) * i) / 12,
      );
      await wait(40);
    }
    assert.equal(
      await evaluate(
        `Number(${pet}.firstElementChild.style.getPropertyValue('--row'))`,
      ),
      row,
      "directional sprite row",
    );
    assert.equal(
      await evaluate("scrollY"),
      scroll,
      "drag must not scroll the document",
    );
    await touch(end);
    await wait(100);
    assert.equal(
      await evaluate(`${pet}.getAttribute('aria-expanded')`),
      "false",
      "drop must not open contact",
    );
  };
  await dragTo(35, 400, 2);
  assert.equal(await evaluate(`${dock}.dataset.side`), "left");
  await dragTo(350, 450, 1);
  assert.equal(await evaluate(`${dock}.dataset.side`), "right");
  await dragTo(35, 400, 2, "touchCancel");
  assert.equal(
    await evaluate(`${dock}.dataset.side`),
    "right",
    "cancel retains original dock",
  );
  let start = await center();
  await touch("touchStart", start.x, start.y);
  await touch("touchMove", start.x + 4, start.y - 4);
  await touch("touchEnd");
  await wait(100);
  assert.equal(
    await evaluate(`${pet}.getAttribute('aria-expanded')`),
    "true",
    "small finger jitter is a tap",
  );
  await evaluate(
    'document.querySelector("[aria-label=\\"Close contact form\\"]").click()',
  );
  await evaluate(
    'document.querySelector("[aria-label=\\"Mini Dotan settings\\"]").click()',
  );
  await evaluate(
    `Array.from(${dock}.querySelectorAll('button')).find(b=>b.textContent.includes('Quiet mode')).click()`,
  );
  await evaluate(
    'document.querySelector("[aria-label=\\"Mini Dotan settings\\"]").click()',
  );
  await dragTo(35, 400, 0);
  assert.equal(
    await evaluate(`${dock}.dataset.side`),
    "left",
    "quiet mode still permits direct placement",
  );
  start = await center();
  await touch("touchStart", start.x, start.y);
  await touch("touchEnd");
  await wait(100);
  assert.equal(
    await evaluate(`${pet}.getAttribute('aria-expanded')`),
    "true",
    "tap works after a drag in quiet mode",
  );
  console.log(
    "Touch checks passed: both walking rows, docking, cancellation, click suppression, finger jitter, quiet mode, document scroll isolation, contact access.",
  );
} finally {
  socket.close();
}
