"use strict";
// Julia Time 0.5 fix round 2, package P03: the Board's minutes come from one table that matches the lesson and
// chapter files, and the time promise is the sum of them, rounded to the half hour. Nothing is hard-coded twice.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const web = path.join(root, "web", "course");
const client = require("../web/course/course-client.js");
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, "lessons", name), "utf8"));

test("each step's lesson minutes equal lessonN.json, and its chapter minutes equal examN.json when the file has them", () => {
  client.STEPS.forEach((step, i) => {
    const n = i + 1, lesson = readJson("lesson" + n + ".json"), exam = readJson("exam" + n + ".json");
    assert.equal(step.lessonMinutes, lesson.minutes, "STEPS[" + i + "].lessonMinutes must equal lessons/lesson" + n + ".json minutes (" + lesson.minutes + ")");
    if (exam.minutes !== undefined) assert.equal(step.chapterMinutes, exam.minutes, "STEPS[" + i + "].chapterMinutes must equal lessons/exam" + n + ".json minutes (" + exam.minutes + ")");
    assert.equal(step.minutes, step.lessonMinutes + step.chapterMinutes);
    assert.ok(Number.isInteger(step.chapterMinutes) && step.chapterMinutes >= 3 && step.chapterMinutes <= 60);
  });
});

test("the time promise is the sum of every step plus the intro and the ending, rounded to the nearest half hour", () => {
  const total = client.STEPS.reduce((sum, step) => sum + step.minutes, 0) + client.INTRO_MINUTES + client.ENDING_MINUTES;
  const promise = client.timePromise();
  assert.equal(promise.minutes, total);
  assert.equal(promise.hours, Math.round(total / 30) / 2);
  assert.ok(Math.abs(promise.hours * 60 - total) <= 15, "within a quarter hour of the real total");
  const words = promise.hours % 1 ? Math.floor(promise.hours) + "½ hours" : promise.hours + " hours";
  assert.equal(promise.text, words.replace(/^0/, ""));
});

test("the Board page and the intro show that promise; no hours or minutes are written into the page text", () => {
  const html = fs.readFileSync(path.join(web, "index.html"), "utf8");
  assert.doesNotMatch(html, /about \d+ hours|about three hours|\d+ to \d+ minutes/);
  const intro = fs.readFileSync(path.join(web, "intro-script.js"), "utf8");
  assert.doesNotMatch(intro, /three hours|\d hours/);
  assert.match(intro, /about \{time\} in all/);
  const introJs = require("../web/course/intro.js");
  const script = require("../web/course/intro-script.js");
  assert.match(introJs.captionText(script.scenes[0]), new RegExp("about " + client.timePromise().text + " in all"));
  // The Board fills the hero in from the same function.
  const elements = {}, listeners = {};
  const fake = id => ({id, href: "", textContent: "", hidden: false, dataset: {}, className: "", children: [], classList: {toggle() {}, add() {}, remove() {}}, setAttribute() {},
    append(...k) { this.children.push(...k); }, replaceChildren(...k) { this.children = [...k]; }});
  const document = {getElementById(id) { return elements[id] || (elements[id] = fake(id)); }, createElement() { return fake("new"); }, addEventListener(n, f) { listeners[n] = f; }};
  const window = {location: {search: "", protocol: "http:", host: "127.0.0.1:9671"}, localStorage: null, document};
  const context = vm.createContext({window, document, URLSearchParams, console});
  for (const file of ["course-state.js", "legacy-import.js", "course-client.js", "intro-script.js", "course-board.js"])
    vm.runInContext(fs.readFileSync(path.join(web, file), "utf8"), context, {filename: file});
  listeners.DOMContentLoaded();
  assert.equal(elements["time-promise"].textContent, client.timePromise().text);
  assert.equal(elements["ending-minutes"].textContent, String(client.ENDING_MINUTES));
});
